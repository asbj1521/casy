-- Genveje (#175): plans a person saved to run again with one tap (padel
-- every week). Only ever the person's own, read and written by the
-- plan-presets function. The plan is what the Planlæg sheet holds: the
-- event's name, its time, days and length, who is coming, the place, note
-- and deadline, and (from step B) the several times it may look at. Never
-- anything from a calendar.
--
-- Kept until the person deletes it, and with the account. A group that is
-- deleted leaves its genveje without one (picked again before they run).
--
-- Safe to run twice.

create table if not exists plan_presets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  group_id uuid references friend_groups (id) on delete set null,
  plan jsonb not null check (jsonb_typeof(plan) = 'object' and octet_length(plan::text) < 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plan_presets_profile_idx on plan_presets (profile_id, created_at);

comment on table plan_presets is
  'Genveje (#175): a person''s saved plans, run again with one tap. Their own only, through the plan-presets function. Kept until deleted, and with the account.';

-- Like every table: the browser reads and writes nothing; the functions do.
alter table plan_presets enable row level security;

-- At most 9 a person, whatever calls the database.
create or replace function plan_presets_cap() returns trigger
language plpgsql
as $$
begin
  if (select count(*) from plan_presets where profile_id = new.profile_id) >= 9 then
    raise exception 'plan_presets: at most 9 per person';
  end if;
  return new;
end;
$$;

drop trigger if exists plan_presets_cap on plan_presets;
create trigger plan_presets_cap
  before insert on plan_presets
  for each row execute function plan_presets_cap();
