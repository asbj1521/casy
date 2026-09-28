-- The primary calendar: the one calendar Casy adds agreed events to, chosen
-- by its owner on the profile page or My calendar.
--
-- Casy only ever writes to it when asked: an "Add to my calendar" click on a
-- scheduled event, or every scheduled event once "Add automatically" is on.
-- Nothing is written for someone who never picks one.

-- Whether Casy may add events to a calendar at all. Only iCloud reports it so
-- far (an account's own calendars yes; subscriptions and calendars shared
-- view-only no); Google, Outlook and calendar links stay false until Casy
-- asks those providers for write access. Existing iCloud calendars start
-- false and are corrected by their next sync (hourly, or "Sync now").
alter table calendar_sources
  add column if not exists writable boolean not null default false;

-- One row per person who has chosen a primary calendar. Removing that
-- calendar (or its whole account) removes the row, so "Add automatically"
-- switches itself off rather than pointing at a calendar that is gone.
create table if not exists primary_calendars (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  source_id uuid not null references calendar_sources (id) on delete cascade,
  auto_add boolean not null default false,
  -- The language Casy writes the calendar entries in: the site's language
  -- when the person last saved these settings.
  lang text not null default 'da' check (lang in ('da', 'en')),
  updated_at timestamptz not null default now()
);

create index if not exists primary_calendars_source_id_idx
  on primary_calendars (source_id);

comment on table primary_calendars is
  'The calendar each person lets Casy add agreed events to, and whether it does so automatically.';

-- The calendar must be the person's own. The function that sets it checks
-- this too; this is the lock, so a mistake there can't point Casy at someone
-- else's calendar.
create or replace function enforce_own_primary_calendar() returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from calendar_sources s
    join calendar_connections c on c.id = s.connection_id
    where s.id = new.source_id and c.profile_id = new.profile_id
  ) then
    raise exception 'primary calendar % does not belong to %', new.source_id, new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists primary_calendars_enforce_own on primary_calendars;
create trigger primary_calendars_enforce_own
  before insert or update on primary_calendars
  for each row execute function enforce_own_primary_calendar();

revoke execute on function enforce_own_primary_calendar() from public, anon, authenticated;

-- Like every other table: RLS on, no policies. Only Edge Functions (service
-- role) read or write it.
alter table primary_calendars enable row level security;
