-- Ranking a vote's dates by what they cost people's important events (#119).
--
-- Each person's phone knows which of their events matter (the labels from #112
-- stay on the phone). For the ranking it sends only what the rules need, per
-- important (high or critical) event: when it starts, how important it is,
-- what to keep clear of the night before, and how many days it needs to
-- prepare. No title, no kind, no reason. The server combines everyone's facts
-- against the planned event and returns only one score per date, never whose.
--
-- A push replaces a person's facts as a whole (replace_ai_day_facts), so what
-- the phone no longer lists is gone at once. Facts go when the person withdraws
-- their yes to the AI using their calendar, with the account (cascade), and 30
-- days after the last push, nightly, so a phone that stopped sending doesn't
-- leave them behind.
--
-- A vote's dates keep the score they got when the vote was made
-- (event_proposal_dates.match_score), so everyone sees the same number on the
-- cards without the server holding anything to work it out again.
--
-- Safe to run twice.

do $$
begin
  if to_regclass('public.ai_consent') is null then
    raise exception 'ai_consent is missing: apply 20261022120000_ai_consent first';
  end if;
  if to_regclass('public.event_proposal_dates') is null then
    raise exception 'event_proposal_dates is missing: apply 20260922120000_event_proposals first';
  end if;
end;
$$;

create table if not exists ai_day_facts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  level text not null check (level in ('high', 'critical')),
  avoid text[] not null default '{}',
  prep_days smallint not null default 0 check (prep_days between 0 and 14),
  pushed_at timestamptz not null default now()
);

create index if not exists ai_day_facts_profile_idx on ai_day_facts (profile_id);

comment on table ai_day_facts is
  'Per person, what the ranking of a vote''s dates needs to know of their important events: start, level, what to avoid the night before, prep days. No titles or kinds. Replaced whole on every push, deleted on withdrawal and with the account, and 30 days after the last push.';

-- Like every table: the browser reads and writes nothing; the functions do.
alter table ai_day_facts enable row level security;

alter table event_proposal_dates
  add column if not exists match_score smallint check (match_score between 0 and 100);

comment on column event_proposal_dates.match_score is
  'How well this date suits the group by the members'' important events, 0 to 100, worked out when the vote was made (#119). Null when it was not.';

-- Replace one person's facts with `p_facts` (a JSON array of
-- { start, level, avoid, prepDays }, already checked by the function), in one
-- transaction. Returns how many are stored.
create or replace function replace_ai_day_facts(p_profile_id uuid, p_facts jsonb)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  if p_profile_id is null then
    raise exception 'replace_ai_day_facts: p_profile_id is required';
  end if;
  if p_facts is null or jsonb_typeof(p_facts) <> 'array' then
    raise exception 'replace_ai_day_facts: p_facts must be a JSON array';
  end if;

  delete from ai_day_facts where profile_id = p_profile_id;

  insert into ai_day_facts (profile_id, starts_at, level, avoid, prep_days)
  select
    p_profile_id,
    to_timestamp((f ->> 'start')::double precision / 1000.0),
    f ->> 'level',
    coalesce(
      array(select jsonb_array_elements_text(coalesce(f -> 'avoid', '[]'::jsonb))),
      '{}'
    ),
    coalesce((f ->> 'prepDays')::smallint, 0)
  from jsonb_array_elements(p_facts) as f;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function replace_ai_day_facts(uuid, jsonb) from public, anon, authenticated;
grant execute on function replace_ai_day_facts(uuid, jsonb) to service_role;

-- The 30 days after the last push, every night (UTC, beside the other
-- cleanup). Scheduling under a name it already has replaces that job.
select cron.schedule(
  'ai-day-facts-30-days',
  '55 2 * * *',
  $job$ delete from public.ai_day_facts where pushed_at < now() - interval '30 days'; $job$
);
