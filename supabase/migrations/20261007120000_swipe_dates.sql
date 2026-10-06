-- Swiping through candidate dates (#74). Instead of one date at a time,
-- where every decline sent the whole group back to their calendars, an event
-- can offer several dates at once (mode 'vote'). Everyone answers each of
-- them once: 'accepted' (I can), 'maybe' (I can, but would rather not) or
-- 'declined' (I can't). Then the date nobody declined, with the fewest
-- 'maybe', earliest first, is chosen (decide_vote). If every date has a
-- decline, the person who suggested it picks one (choose_vote_date).
--
-- Events suggested before this keep mode 'single' and the old flow: one
-- current date, a decline swaps in the next (respond_to_event), unchanged.
--
-- Written to fail rather than guess: the response check is replaced by name,
-- so its name is checked first.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_responses_response_check'
      and conrelid = 'event_responses'::regclass
  ) then
    raise exception 'event_responses_response_check not found: check the constraint''s name first';
  end if;
end;
$$;

-- 'single': the original flow. 'vote': several candidate dates, answered all
-- at once. answer_by is a vote's deadline: past it, the dates are decided
-- with whatever answers there are.
alter table event_proposals
  add column mode text not null default 'single' check (mode in ('single', 'vote')),
  add column answer_by timestamptz;

-- When a vote's date was chosen. A vote's dates are all offered at once, so
-- its current date is the chosen one, not the newest (event_current_date).
alter table event_proposal_dates add column chosen_at timestamptz;

alter table event_responses drop constraint event_responses_response_check;
alter table event_responses add constraint event_responses_response_check
  check (response in ('accepted', 'maybe', 'declined'));

-- The votes whose deadline may have passed, read on every event list.
create index event_proposals_open_votes_idx on event_proposals (answer_by)
  where mode = 'vote' and status = 'pending';

comment on column event_proposals.mode is
  'single: one date at a time, a decline swaps in the next. vote: several dates answered at once (#74).';

-- The date on offer: for a single-date event the newest one nobody declined,
-- as before; for a vote the chosen date, so none until it is decided.
create or replace function event_current_date(p_proposal_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select d.id
  from event_proposal_dates d
  join event_proposals p on p.id = d.proposal_id
  where d.proposal_id = p_proposal_id
    and d.declined_at is null
    and (p.mode = 'single' or d.chosen_at is not null)
  order by d.created_at desc
  limit 1;
$$;

-- Decide a pending vote if it is time to: once everyone still invited has
-- answered every date yet to come, once its deadline has passed, or when
-- p_force says so. The winner is the upcoming date nobody declined with the
-- fewest 'maybe', the earliest of those; someone who never answered counts
-- against no date. Callers hold the event's row lock (or don't need one:
-- deciding twice chooses the same date).
--
-- Returns 'scheduled', 'open' (still waiting for answers), 'undecided' (due,
-- but every date has a decline: the suggester picks), 'no_date' (every date
-- has passed) or 'closed' (not a pending vote).
create or replace function decide_vote(p_proposal_id uuid, p_force boolean)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_mode text;
  v_answer_by timestamptz;
  v_missing int;
  v_winner uuid;
begin
  select status, mode, answer_by into v_status, v_mode, v_answer_by
  from event_proposals where id = p_proposal_id;
  if v_status is distinct from 'pending' or v_mode is distinct from 'vote' then
    return 'closed';
  end if;

  if not exists (
    select 1 from event_proposal_dates
    where proposal_id = p_proposal_id and starts_at > now()
  ) then
    update event_proposals set status = 'no_date', updated_at = now() where id = p_proposal_id;
    return 'no_date';
  end if;

  -- Answers still owed: someone invited with no answer on a date yet to come.
  select count(*) into v_missing
  from event_invitees i
  join event_proposal_dates d on d.proposal_id = i.proposal_id
  where i.proposal_id = p_proposal_id
    and d.starts_at > now()
    and not exists (
      select 1 from event_responses r where r.date_id = d.id and r.profile_id = i.profile_id
    );
  if v_missing > 0 and not p_force and (v_answer_by is null or v_answer_by > now()) then
    return 'open';
  end if;

  -- Only the answers of people still invited count: someone who left the
  -- event or the group no longer has a say.
  select d.id into v_winner
  from event_proposal_dates d
  where d.proposal_id = p_proposal_id
    and d.starts_at > now()
    and not exists (
      select 1
      from event_responses r
      join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
      where r.date_id = d.id and r.response = 'declined'
    )
  order by
    (
      select count(*)
      from event_responses r
      join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
      where r.date_id = d.id and r.response = 'maybe'
    ),
    d.starts_at
  limit 1;

  if v_winner is null then
    return 'undecided';
  end if;

  update event_proposal_dates set chosen_at = now() where id = v_winner;
  update event_proposals set status = 'scheduled', updated_at = now() where id = p_proposal_id;
  return 'scheduled';
end;
$$;

-- As before for a single-date event: scheduled once everyone has accepted
-- its current date. A vote is decided by its own rule instead, so leaving an
-- event or a group (leave_event, leave_friend_group, which call this) can
-- complete a vote just as it can complete a single date.
create or replace function refresh_event_status(p_proposal_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_mode text;
  v_date uuid;
  v_missing int;
begin
  select mode into v_mode from event_proposals where id = p_proposal_id;
  if v_mode = 'vote' then
    perform decide_vote(p_proposal_id, false);
    return;
  end if;

  v_date := event_current_date(p_proposal_id);
  if v_date is null then
    return;
  end if;
  select count(*) into v_missing
  from event_invitees i
  where i.proposal_id = p_proposal_id
    and not exists (
      select 1 from event_responses r
      where r.date_id = v_date and r.profile_id = i.profile_id and r.response = 'accepted'
    );
  if v_missing = 0 then
    update event_proposals
    set status = 'scheduled', updated_at = now()
    where id = p_proposal_id and status = 'pending';
  end if;
end;
$$;

-- Suggest a vote, in one transaction: the event, every candidate date (a
-- jsonb array of {start, end}, checked by the Edge Function), and everyone in
-- the group as invitees, the suggester included: they answer the dates too.
create or replace function suggest_vote_event(
  p_group_id uuid,
  p_created_by uuid,
  p_title text,
  p_settings jsonb,
  p_dates jsonb,
  p_answer_by timestamptz
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_open int;
  v_proposal uuid;
begin
  if jsonb_typeof(p_dates) is distinct from 'array' or jsonb_array_length(p_dates) = 0 then
    raise exception 'A vote needs at least one date';
  end if;

  select count(*) into v_open
  from event_proposals
  where group_id = p_group_id and status = 'pending';
  if v_open >= 20 then
    raise exception 'This group already has 20 events waiting for answers.'
      using errcode = 'check_violation';
  end if;

  insert into event_proposals (group_id, created_by, title, settings, mode, answer_by)
  values (p_group_id, p_created_by, p_title, p_settings, 'vote', p_answer_by)
  returning id into v_proposal;

  insert into event_proposal_dates (proposal_id, starts_at, ends_at)
  select v_proposal, (e ->> 'start')::timestamptz, (e ->> 'end')::timestamptz
  from jsonb_array_elements(p_dates) e;

  insert into event_invitees (proposal_id, profile_id)
  select v_proposal, profile_id from group_members where group_id = p_group_id;

  return v_proposal;
end;
$$;

-- Answer one of a vote's dates (or change an answer), with the event locked
-- so the answer that completes it decides it exactly once.
--
-- Returns 'answered', 'scheduled' (this answer decided it), 'undecided'
-- (it completed the answers, but every date has a decline), 'no_date',
-- 'closed', 'past' (that date has begun), 'not_invited', 'not_vote' or
-- 'not_found'.
create or replace function respond_to_vote(
  p_proposal_id uuid,
  p_date_id uuid,
  p_profile_id uuid,
  p_response text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_mode text;
  v_starts timestamptz;
  v_outcome text;
begin
  if p_response not in ('accepted', 'maybe', 'declined') then
    raise exception 'Unknown response %', p_response;
  end if;

  select status, mode into v_status, v_mode
  from event_proposals where id = p_proposal_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_mode <> 'vote' then
    return 'not_vote';
  end if;
  if v_status <> 'pending' then
    return 'closed';
  end if;
  if not exists (
    select 1 from event_invitees where proposal_id = p_proposal_id and profile_id = p_profile_id
  ) then
    return 'not_invited';
  end if;
  select starts_at into v_starts
  from event_proposal_dates where id = p_date_id and proposal_id = p_proposal_id;
  if not found then
    return 'not_found';
  end if;
  if v_starts <= now() then
    return 'past';
  end if;

  insert into event_responses (date_id, profile_id, response)
  values (p_date_id, p_profile_id, p_response)
  on conflict (date_id, profile_id) do update
    set response = excluded.response, responded_at = now();

  v_outcome := decide_vote(p_proposal_id, false);
  return case when v_outcome in ('scheduled', 'undecided', 'no_date') then v_outcome
              else 'answered' end;
end;
$$;

-- The suggester picks a vote's date themselves: when every date has a
-- decline, or early, without waiting for everyone. Whoever said they can't
-- make that date is taken off the event, as if they had left it, so it is
-- never put into their calendar; the suggester never is.
--
-- Returns 'scheduled', 'not_creator', 'closed', 'past', 'not_vote' or 'not_found'.
create or replace function choose_vote_date(
  p_proposal_id uuid,
  p_date_id uuid,
  p_profile_id uuid
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_mode text;
  v_creator uuid;
  v_starts timestamptz;
begin
  select status, mode, created_by into v_status, v_mode, v_creator
  from event_proposals where id = p_proposal_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_mode <> 'vote' then
    return 'not_vote';
  end if;
  if v_creator is distinct from p_profile_id then
    return 'not_creator';
  end if;
  if v_status <> 'pending' then
    return 'closed';
  end if;
  select starts_at into v_starts
  from event_proposal_dates where id = p_date_id and proposal_id = p_proposal_id;
  if not found then
    return 'not_found';
  end if;
  if v_starts <= now() then
    return 'past';
  end if;

  update event_proposal_dates set chosen_at = now() where id = p_date_id;
  delete from event_invitees i
  where i.proposal_id = p_proposal_id
    and i.profile_id <> p_profile_id
    and exists (
      select 1 from event_responses r
      where r.date_id = p_date_id and r.profile_id = i.profile_id and r.response = 'declined'
    );
  update event_proposals set status = 'scheduled', updated_at = now() where id = p_proposal_id;
  return 'scheduled';
end;
$$;

-- Decide the votes whose deadline has passed: the caller's own (p_profile_id
-- set, on every event list) or all of them (null, from the hourly sync). A
-- vote another call is deciding right now is skipped, not waited for.
-- Returns the ids of the ones it scheduled, whose calendar entries are due.
create or replace function decide_due_votes(p_profile_id uuid)
returns setof uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select p.id
    from event_proposals p
    where p.mode = 'vote'
      and p.status = 'pending'
      and p.answer_by <= now()
      and (
        p_profile_id is null
        or exists (
          select 1 from event_invitees i where i.proposal_id = p.id and i.profile_id = p_profile_id
        )
      )
    for update skip locked
  loop
    if decide_vote(v_id, false) = 'scheduled' then
      return next v_id;
    end if;
  end loop;
end;
$$;

-- Service role only, like every other event function.
revoke execute on function decide_vote(uuid, boolean) from public, anon, authenticated;
revoke execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
revoke execute on function respond_to_vote(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function choose_vote_date(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function decide_due_votes(uuid) from public, anon, authenticated;
grant execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz)
  to service_role;
grant execute on function respond_to_vote(uuid, uuid, uuid, text) to service_role;
grant execute on function choose_vote_date(uuid, uuid, uuid) to service_role;
grant execute on function decide_due_votes(uuid) to service_role;
