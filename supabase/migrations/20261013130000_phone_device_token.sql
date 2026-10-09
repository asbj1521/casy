-- The phone's own token for sending its calendars in the background (#63),
-- when iOS wakes the app without its web page (and so without the person's
-- login). It can only update its own phone connection's busy times; only its
-- SHA-256 is stored, and it goes with the connection.
--
-- Its own migration: it was first added to phone_calendars after that had
-- already been applied, which a database never re-runs. Safe either way.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'calendar_connections' and column_name = 'device_id'
  ) then
    raise exception 'phone_device_token needs the phone_calendars migration first';
  end if;
end $$;

alter table calendar_connections add column if not exists device_token_hash text;

comment on column calendar_connections.device_token_hash is
  'provider = device only: SHA-256 (hex) of the token the phone sends its calendars with in the background (calendar-phone).';
