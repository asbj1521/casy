-- AI budgets per person and skill (#111). Until now one cap of 50 calls a
-- day was shared by everyone, so one person testing could use it up for all.
-- Each call now says which skill made it and for whom, so every skill has a
-- daily limit per person, under one ceiling for all calls together that
-- protects the bill.
--
-- Still no text, ever: a row is that a call happened, for whom, by which
-- skill, and what it used. The person is deleted with their account
-- (cascade), and every row after 30 days, nightly (below), so the 30 days
-- hold even on a day nobody calls.

do $$
begin
  if to_regclass('public.ai_calls') is null then
    raise exception 'ai_calls is missing: apply 20261012120000_ai_calls first';
  end if;
end;
$$;

alter table ai_calls
  add column if not exists skill text,
  add column if not exists profile_id uuid references auth.users (id) on delete cascade,
  add column if not exists cache_read_tokens int,
  add column if not exists cache_write_tokens int;

create index if not exists ai_calls_profile_skill_idx on ai_calls (profile_id, skill, called_at);

comment on table ai_calls is
  'One row per AI call: when, which skill, for whom, and the tokens it used. No text. Kept 30 days.';

-- Take one of today's calls for `p_skill` on behalf of `p_profile_id`:
-- {"id": .., "userLeft": ..} when one is free, else {"exhausted": "user"}
-- (this person's limit for this skill) or {"exhausted": "global"} (all
-- calls together). Takes the same lock as claim_ai_call, so the two count
-- one queue while the old one is still deployed.
create or replace function claim_ai_skill_call(
  p_skill text,
  p_profile_id uuid,
  p_user_limit int,
  p_global_limit int
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_used int;
begin
  if p_skill is null or p_skill !~ '^[a-z][a-z0-9-]{1,40}$' then
    raise exception 'claim_ai_skill_call: p_skill must be a short lower-case name';
  end if;
  if p_profile_id is null then
    raise exception 'claim_ai_skill_call: p_profile_id is required';
  end if;
  if p_user_limit is null or p_user_limit < 0 or p_global_limit is null or p_global_limit < 0 then
    raise exception 'claim_ai_skill_call: limits must be 0 or more';
  end if;

  perform pg_advisory_xact_lock(hashtext('claim_ai_call'));

  if (select count(*) from ai_calls where called_at >= ai_day_start()) >= p_global_limit then
    return jsonb_build_object('exhausted', 'global');
  end if;
  select count(*) into v_used
  from ai_calls
  where profile_id = p_profile_id and skill = p_skill and called_at >= ai_day_start();
  if v_used >= p_user_limit then
    return jsonb_build_object('exhausted', 'user');
  end if;

  insert into ai_calls (skill, profile_id) values (p_skill, p_profile_id) returning id into v_id;
  return jsonb_build_object('id', v_id, 'userLeft', p_user_limit - v_used - 1);
end;
$$;

-- Calls and tokens per skill, today (Danish time) and over the 30 days kept:
-- the admin overview's usage and cost. Counts only, never who.
create or replace function ai_usage()
returns table (
  skill text,
  calls_today int,
  calls_30d int,
  input_tokens_today bigint,
  output_tokens_today bigint,
  input_tokens_30d bigint,
  output_tokens_30d bigint
)
language sql
stable
set search_path = public
as $$
  select
    -- Calls from before skills were recorded.
    coalesce(a.skill, 'earlier'),
    (count(*) filter (where a.called_at >= ai_day_start()))::int,
    count(*)::int,
    coalesce(sum(a.input_tokens) filter (where a.called_at >= ai_day_start()), 0)::bigint,
    coalesce(sum(a.output_tokens) filter (where a.called_at >= ai_day_start()), 0)::bigint,
    coalesce(sum(a.input_tokens), 0)::bigint,
    coalesce(sum(a.output_tokens), 0)::bigint
  from ai_calls a
  where a.called_at >= now() - interval '30 days'
  group by 1
  order by 1;
$$;

-- Your own calls per skill over the 30 days kept, for Your data.
create or replace function my_ai_calls(p_profile_id uuid)
returns table (skill text, calls int, last_at timestamptz)
language sql
stable
set search_path = public
as $$
  select a.skill, count(*)::int, max(a.called_at)
  from ai_calls a
  where a.profile_id = p_profile_id
  group by a.skill
  order by a.skill;
$$;

revoke execute on function claim_ai_skill_call(text, uuid, int, int) from public, anon, authenticated;
grant execute on function claim_ai_skill_call(text, uuid, int, int) to service_role;
revoke execute on function ai_usage() from public, anon, authenticated;
grant execute on function ai_usage() to service_role;
revoke execute on function my_ai_calls(uuid) from public, anon, authenticated;
grant execute on function my_ai_calls(uuid) to service_role;

-- The 30 days, every night (UTC, a quiet hour beside the other cleanup).
-- Scheduling under a name it already has replaces that job, so this can run twice.
select cron.schedule(
  'ai-calls-30-days',
  '50 2 * * *',
  $job$ delete from public.ai_calls where called_at < now() - interval '30 days'; $job$
);
