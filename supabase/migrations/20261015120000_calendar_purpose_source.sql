-- Who set a calendar's category (#118): its owner ('user') or Casy's AI
-- ('ai'), or nobody yet (null). The AI only ever fills a calendar nobody has
-- touched (purpose and purpose_source both null), and sets 'ai' even when it
-- can't tell, so it never asks about that calendar again; a category its owner
-- picks or clears is 'user' from then on, and the AI never touches it.

-- Fails safely: adding a nullable column changes no existing row.
alter table calendar_sources
  add column if not exists purpose_source text
    check (purpose_source in ('user', 'ai'));

-- Every category set so far was picked by hand: no AI existed.
update calendar_sources
set purpose_source = 'user'
where purpose is not null and purpose_source is null;

-- sync_phone_calendars again, unchanged but for carrying purpose_source over
-- with the category when the app is reinstalled, so a choice made by hand
-- stays one.
create or replace function sync_phone_calendars(
  p_profile_id uuid,
  p_device_id uuid,
  p_label text,
  p_create boolean,
  p_from timestamptz,
  p_calendars jsonb
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_conn uuid;
  v_blocks jsonb;
  v_stored integer;
  v_old uuid[];
begin
  select id into v_conn
  from calendar_connections
  where profile_id = p_profile_id and provider = 'device' and device_id = p_device_id
  for update;

  if v_conn is null then
    if not p_create then
      return jsonb_build_object('gone', true);
    end if;
    insert into calendar_connections (profile_id, provider, device_id, account_label, status)
    values (p_profile_id, 'device', p_device_id, p_label, 'connected')
    returning id into v_conn;

    select array_agg(id) into v_old
    from calendar_connections
    where profile_id = p_profile_id and provider = 'device' and id <> v_conn
      and account_label is not distinct from p_label;
  end if;

  delete from calendar_sources s
  where s.connection_id = v_conn
    and s.external_calendar_id not in (
      select x->>'id' from jsonb_array_elements(p_calendars) as x
    );

  insert into calendar_sources (connection_id, external_calendar_id, display_name, included, writable)
  select v_conn, x->>'id', x->>'name', not coalesce((x->>'hidden')::boolean, false),
         coalesce((x->>'writable')::boolean, false)
  from jsonb_array_elements(p_calendars) as x
  on conflict (connection_id, external_calendar_id)
    do update set display_name = excluded.display_name, writable = excluded.writable;

  if v_old is not null then
    update calendar_sources n
    set purpose = o.purpose, purpose_source = o.purpose_source, priority = o.priority,
        included = o.included, custom_name = o.custom_name
    from calendar_sources o
    where n.connection_id = v_conn
      and o.connection_id = any (v_old)
      and o.external_calendar_id = n.external_calendar_id;
    delete from calendar_connections where id = any (v_old);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'source_id', s.id, 'start_at', b->>'start', 'end_at', b->>'end'
  )), '[]'::jsonb)
  into v_blocks
  from jsonb_array_elements(p_calendars) as x
  join calendar_sources s on s.connection_id = v_conn and s.external_calendar_id = x->>'id'
  cross join lateral jsonb_array_elements(coalesce(x->'blocks', '[]'::jsonb)) as b;

  v_stored := replace_busy_blocks(v_conn, p_from, v_blocks);

  update calendar_connections
  set status = 'connected',
      account_label = p_label,
      last_synced_at = now(),
      last_sync_attempt_at = now(),
      sync_error = null,
      needs_reconnect = false
  where id = v_conn;

  return jsonb_build_object('connection_id', v_conn, 'busy_blocks', v_stored);
end;
$$;

revoke execute on function sync_phone_calendars(uuid, uuid, text, boolean, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function sync_phone_calendars(uuid, uuid, text, boolean, timestamptz, jsonb)
  to service_role;
