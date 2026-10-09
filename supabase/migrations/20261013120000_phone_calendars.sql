-- The phone's own calendars as a fifth provider (#63): the iPhone app reads
-- every calendar on the phone through EventKit and sends their busy times
-- here (the calendar-phone function). There is no credential and nothing for
-- the server to fetch: the phone pushes, so the hourly sync, a group's
-- refresh and the health check all leave these connections alone.

-- Fail early and clearly if an earlier migration is missing.
do $$
begin
  if to_regclass('public.calendar_connections') is null
    or to_regprocedure('public.replace_busy_blocks(uuid, timestamptz, jsonb)') is null
    or not exists (
      select 1 from information_schema.columns
      where table_name = 'calendar_sources' and column_name = 'custom_name'
    )
  then
    raise exception 'phone_calendars needs the calendar tables and replace_busy_blocks first';
  end if;
end $$;

-- Widen the provider check (found by definition, as in the ics_provider migration).
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'calendar_connections'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%provider%'
  loop
    execute format('alter table calendar_connections drop constraint %I', c.conname);
  end loop;
end $$;

-- Which phone a device connection is. A random id the app makes once and
-- keeps; it says nothing about the phone or the person.
alter table calendar_connections add column if not exists device_id uuid;

alter table calendar_connections
  add constraint calendar_connections_provider_check
  check (provider in ('google', 'outlook', 'apple', 'ics', 'device'));

alter table calendar_connections
  add constraint calendar_connections_device_id_check
  check ((provider = 'device') = (device_id is not null));

create unique index if not exists calendar_connections_device_idx
  on calendar_connections (profile_id, device_id)
  where device_id is not null;

comment on column calendar_connections.device_id is
  'provider = device only: the random id the iPhone app made for itself, so each phone is one connection.';

-- The phone's own token for sending in the background, when iOS wakes the
-- app without its web page (and so without the person's login). It can only
-- update this one connection's busy times; only its SHA-256 is stored, and it
-- goes with the connection.
alter table calendar_connections add column if not exists device_token_hash text;

comment on column calendar_connections.device_token_hash is
  'provider = device only: SHA-256 (hex) of the token the phone sends its calendars with in the background (calendar-phone).';

-- One push from the phone, in one transaction: its calendars (new ones added,
-- renamed ones renamed, ones gone from the phone removed) and every busy
-- block from p_from on swapped for the new set (replace_busy_blocks).
--
-- p_calendars: [{ id, name, hidden, blocks: [{ start, end }] }], validated by
-- the function (calendar-phone) first. `hidden` unticks a calendar the first
-- time it is seen (a subscription of only whole days: holidays).
--
-- With no connection for this phone yet, p_create says whether to make one:
-- only "Connect this phone" does. A background push for a connection removed
-- since (on the website, say) answers { gone: true } and changes nothing, so
-- removing it there is never undone by the app.
--
-- Connecting makes this phone's connection replace the person's other phone
-- connections with the same label: the same phone after the app lost its id
-- (reinstalled), not a second account. Calendar settings carry over by
-- EventKit's calendar id, which belongs to the phone, not the app.
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

  insert into calendar_sources (connection_id, external_calendar_id, display_name, included)
  select v_conn, x->>'id', x->>'name', not coalesce((x->>'hidden')::boolean, false)
  from jsonb_array_elements(p_calendars) as x
  on conflict (connection_id, external_calendar_id)
    do update set display_name = excluded.display_name;

  if v_old is not null then
    update calendar_sources n
    set purpose = o.purpose, priority = o.priority, included = o.included,
        custom_name = o.custom_name
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
