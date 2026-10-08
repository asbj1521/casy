-- The suggester answers before sending (#101). On a phone, whoever suggests
-- a vote swipes its dates first, in the scheduling flow: a date they can't
-- make is dropped there and never sent, and their "can" or "can, but rather
-- not" travels with each date that is (p_dates' optional "answer").
--
-- suggest_vote_event keeps its signature and stores those answers in the
-- same transaction as the event, as respond_to_vote would have one by one,
-- then lets the vote decide as an answer does: a vote whose only required
-- member is the suggester is settled at once. Dates sent without an answer
-- (a computer, or a page loaded before this) are stored as before, for the
-- suggester to swipe after sending.
--
-- Fails rather than guesses: the function this replaces must be the one
-- the participants migration made.

do $$
begin
  if to_regprocedure('public.suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text, uuid[])') is null
    or to_regprocedure('public.decide_vote(uuid, boolean)') is null then
    raise exception 'suggester_answers: apply participants first';
  end if;
end;
$$;

create or replace function suggest_vote_event(
  p_group_id uuid,
  p_created_by uuid,
  p_title text,
  p_settings jsonb,
  p_dates jsonb,
  p_answer_by timestamptz,
  p_place text default null,
  p_note text default null,
  p_members uuid[] default null
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
  -- Only the suggester's two answers: a date they can't make isn't sent.
  if exists (
    select 1 from jsonb_array_elements(p_dates) e
    where e ? 'answer' and e ->> 'answer' not in ('accepted', 'maybe')
  ) then
    raise exception 'A suggested date can only carry accepted or maybe';
  end if;

  select count(*) into v_open
  from event_proposals
  where group_id = p_group_id and status = 'pending';
  if v_open >= 20 then
    raise exception 'This group already has 20 events waiting for answers.'
      using errcode = 'check_violation';
  end if;

  insert into event_proposals (group_id, created_by, title, settings, mode, answer_by, place, note)
  values (p_group_id, p_created_by, p_title, p_settings, 'vote', p_answer_by, p_place, p_note)
  returning id into v_proposal;

  insert into event_proposal_dates (proposal_id, starts_at, ends_at)
  select v_proposal, (e ->> 'start')::timestamptz, (e ->> 'end')::timestamptz
  from jsonb_array_elements(p_dates) e;

  -- The members named, or the whole group; only ever people in it.
  insert into event_invitees (proposal_id, profile_id)
  select v_proposal, profile_id from group_members
  where group_id = p_group_id and (p_members is null or profile_id = any(p_members));

  -- The suggester's own answers, if they gave them and are invited.
  if exists (select 1 from jsonb_array_elements(p_dates) e where e ? 'answer') then
    insert into event_responses (date_id, profile_id, response)
    select d.id, p_created_by, e ->> 'answer'
    from jsonb_array_elements(p_dates) e
    join event_proposal_dates d
      on d.proposal_id = v_proposal and d.starts_at = (e ->> 'start')::timestamptz
    where e ? 'answer'
      and exists (
        select 1 from event_invitees
        where proposal_id = v_proposal and profile_id = p_created_by
      );
    perform decide_vote(v_proposal, false);
  end if;

  return v_proposal;
end;
$$;

-- Service role only, like every other event function (create or replace
-- keeps the grants; said again so this file stands on its own).
revoke execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text, uuid[])
  to service_role;
