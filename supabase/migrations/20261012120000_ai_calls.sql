-- Planning with AI (#100): the `plan-ai` Edge Function sends what someone
-- typed about an event to Anthropic's API and turns the answer into the
-- scheduler's settings. Every call costs money, so all calls together are
-- capped per day (Danish time). There is no cap per person on purpose: this
-- is a testing budget, and one row per call is all the cap needs.
--
-- A row says only that a call happened and what it used. No user id and no
-- text: the cap doesn't need to know who, and the text is never stored.
-- Rows older than 30 days are deleted by the next claim, so the table keeps
-- itself small without a place in cleanup_old_data().

create table if not exists ai_calls (
  id bigint generated always as identity primary key,
  called_at timestamptz not null default now(),
  input_tokens int,
  output_tokens int
);

create index if not exists ai_calls_called_at_idx on ai_calls (called_at);

comment on table ai_calls is
  'One row per AI planning call, for the daily cap and its cost. No user id, no text. Kept 30 days.';

alter table ai_calls enable row level security;

-- Today's midnight, Danish time, as an instant: when the day's count starts.
create or replace function ai_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('day', now() at time zone 'Europe/Copenhagen') at time zone 'Europe/Copenhagen';
$$;

-- Take one of today's `p_daily_limit` calls: the new row's id, or null when
-- they are used up. The advisory lock makes concurrent claims take turns, so
-- two requests can't both see 49 and both go ahead.
create or replace function claim_ai_call(p_daily_limit int)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_daily_limit is null or p_daily_limit < 0 then
    raise exception 'claim_ai_call: p_daily_limit must be 0 or more';
  end if;
  perform pg_advisory_xact_lock(hashtext('claim_ai_call'));

  if (select count(*) from ai_calls where called_at >= ai_day_start()) >= p_daily_limit then
    return null;
  end if;

  insert into ai_calls default values returning id into v_id;
  delete from ai_calls where called_at < now() - interval '30 days';
  return v_id;
end;
$$;

-- How many of today's calls are taken: the answer's "calls left", and the
-- admin overview.
create or replace function ai_calls_today()
returns int
language sql
stable
set search_path = public
as $$
  select count(*)::int from ai_calls where called_at >= ai_day_start();
$$;

-- Service role only, like every other function here.
revoke execute on function ai_day_start() from public, anon, authenticated;
grant execute on function ai_day_start() to service_role;
revoke execute on function claim_ai_call(int) from public, anon, authenticated;
grant execute on function claim_ai_call(int) to service_role;
revoke execute on function ai_calls_today() from public, anon, authenticated;
grant execute on function ai_calls_today() to service_role;
