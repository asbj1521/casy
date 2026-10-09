-- Agreed events in the phone's own calendar (#105). A phone calendar the
-- phone lets Casy change can be the primary calendar; the server still says
-- what should be in it (calendar_event_writes), but only the iPhone app can
-- write it, through EventKit, when it runs (calendar-phone's writes/written).

do $$
begin
  if to_regprocedure(
       'public.sync_phone_calendars(uuid, uuid, text, boolean, timestamptz, jsonb)'
     ) is null
    or to_regclass('public.calendar_event_writes') is null
  then
    raise exception 'phone_calendar_writes needs phone_calendars and calendar_event_writes first';
  end if;
end $$;

-- The entry's id on the phone (EventKit's calendarItemIdentifier), so the app
-- can change or remove what it added. Null for every other calendar.
alter table calendar_event_writes add column if not exists device_event_id text;

comment on column calendar_event_writes.device_event_id is
  'Phone calendars only: the EventKit id of the entry the iPhone app added, to update or remove it.';

-- Whether the row's calendar is on a phone, kept by the trigger below. The
-- server's own worker (processWrites) leaves these rows to the phone, and
-- must not even fetch them: unopened phones could fill its batch for good.
alter table calendar_event_writes
  add column if not exists on_phone boolean not null default false;

comment on column calendar_event_writes.on_phone is
  'The calendar is on a phone (provider device): the iPhone app writes it, not the server. Kept by a trigger.';

create or replace function calendar_event_writes_on_phone() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.on_phone := new.source_id is not null and exists (
    select 1
    from calendar_sources s
    join calendar_connections c on c.id = s.connection_id
    where s.id = new.source_id and c.provider = 'device'
  );
  return new;
end;
$$;

-- On insert and whenever the calendar changes, including the calendar being
-- removed (on delete set null is an update, so the row returns to the server,
-- which closes it).
drop trigger if exists calendar_event_writes_on_phone on calendar_event_writes;
create trigger calendar_event_writes_on_phone
  before insert or update of source_id on calendar_event_writes
  for each row execute function calendar_event_writes_on_phone();

-- The server worker's query: what it may do, oldest first.
create index if not exists calendar_event_writes_server_todo_idx
  on calendar_event_writes (updated_at)
  where wanted <> added and not on_phone;

-- sync_phone_calendars again, now also storing whether each calendar can be
-- written (the phone says), on first sight and on every push after.
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
