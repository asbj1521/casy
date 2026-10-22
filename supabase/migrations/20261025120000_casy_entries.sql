-- Tell Casy (#116): what is not in any calendar ("I'm travelling 12 to 19
-- October", "I'm home all of December"), said or written by the person and
-- turned into entries by a skill (entries-ai) they check before saving.
--
-- An entry is busy time of the person's own: `busy` blocks meetings, `away`
-- blocks meetings and trips alike (the way a calendar set to "never skip"
-- does). The groups function adds them to the person's busy time when a group
-- is searched, and calendar-busy hands them to My calendar, which draws them
-- as a built-in "Casy" calendar. They work for every provider, since they
-- need no calendar content.
--
-- Only the structured entry is kept: a short label the person sees and can
-- delete, and its times. The sentence they said is never stored. An entry
-- goes 30 days after it ended (nightly), and with the account.
--
-- Safe to run twice.

create table if not exists casy_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('busy', 'away')),
  label text not null check (char_length(label) between 1 and 60),
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- Whole Danish days (start and end at local midnight): drawn as a bar, not a block of hours.
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists casy_entries_profile_idx on casy_entries (profile_id, start_at);
create index if not exists casy_entries_end_idx on casy_entries (end_at);

comment on table casy_entries is
  'What a person told Casy that is in no calendar (#116): busy or away, with a short label and its times. Never the sentence it came from. Read by the groups function (searches) and calendar-busy (My calendar). Deleted 30 days after it ended and with the account.';

-- Like every table: the browser reads and writes nothing; the functions do.
alter table casy_entries enable row level security;

-- At most 100 entries a person, whatever calls the database: a loop in a page
-- must never fill the table.
create or replace function casy_entries_cap() returns trigger
language plpgsql
as $$
begin
  if (select count(*) from casy_entries where profile_id = new.profile_id) >= 100 then
    raise exception 'casy_entries: at most 100 entries per person';
  end if;
  return new;
end;
$$;

drop trigger if exists casy_entries_cap on casy_entries;
create trigger casy_entries_cap
  before insert on casy_entries
  for each row execute function casy_entries_cap();

-- The 30 days, every night (UTC, beside the other cleanup). Scheduling under a
-- name it already has replaces that job.
select cron.schedule(
  'casy-entries-30-days',
  '59 2 * * *',
  $job$ delete from public.casy_entries where end_at < now() - interval '30 days'; $job$
);
