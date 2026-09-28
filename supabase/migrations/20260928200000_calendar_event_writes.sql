-- Agreed events Casy puts into people's primary calendars, and takes out
-- again when an event is cancelled.
--
-- One row per person and event. `wanted` says whether the event should be in
-- their calendar (an "Add to my calendar" click or "Add automatically" sets
-- it; a cancel clears it); `added` says whether Casy has put it there. When
-- the two differ there is work to do, which the events function tries at
-- once and the hourly sync retries (_shared/calendarWrites.ts). A write is
-- keyed by the event, so trying again never makes a second copy.
--
-- `source_id` is the calendar it went into: the primary calendar at the
-- time. Changing primary calendar later leaves it there (the change's
-- confirmation says so), and a cancel still finds it to remove it.

create table if not exists calendar_event_writes (
  proposal_id uuid not null references event_proposals (id) on delete cascade,
  profile_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references calendar_sources (id) on delete set null,
  wanted boolean not null,
  added boolean not null default false,
  -- Failed tries since `wanted` last changed; the retry stops after a few.
  attempts integer not null default 0,
  -- Why the last try failed, written for the person; null when it worked.
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (proposal_id, profile_id)
);

-- The retry only ever looks for rows with work left to do.
create index if not exists calendar_event_writes_todo_idx
  on calendar_event_writes (updated_at)
  where wanted <> added;

create index if not exists calendar_event_writes_profile_id_idx
  on calendar_event_writes (profile_id);

comment on table calendar_event_writes is
  'Agreed events Casy adds to (and removes from) people''s primary calendars. wanted <> added means work left to do.';

alter table calendar_event_writes enable row level security;
