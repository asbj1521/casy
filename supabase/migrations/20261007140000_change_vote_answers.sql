-- Changing an answer after a vote is decided (#74). Answers to a vote's
-- dates can be changed while it is waiting, and now after it is decided
-- too. Only one change moves anything: saying you can't make the decided
-- date. The vote then opens again and is decided once more by everyone's
-- answers (decide_vote, forced: everyone has had their say): the next date
-- nobody declined, or, if none is left, the suggester chooses. Any other
-- change is kept, and the decided date stays where it is.
--
-- Entries Casy put into people's calendars move with the date. An entry is
-- never overwritten (calendarWrites.ts), so one already added is taken out
-- (wanted false) and marked `requeue`: once it is out, its row is deleted,
-- and the new date goes in like any newly decided event ("Add
-- automatically"). Rows with nothing in a calendar are simply dropped.
--
-- Fails rather than guesses: respond_to_vote must be the one this replaces.

do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'respond_to_vote' and pronargs = 4
  ) then
    raise exception 'respond_to_vote(uuid, uuid, uuid, text) not found: apply swipe_dates first';
  end if;
end;
$$;

alter table calendar_event_writes add column requeue boolean not null default false;

comment on column calendar_event_writes.requeue is
  'The event moved to another date: once this entry is taken out, the row is deleted so the new date can go in.';

-- Answer one of a vote's dates (or change an answer), with the event locked
-- so the answer that completes it, or moves it, does so exactly once.
--
-- Returns 'answered', 'scheduled' (this answer decided it), 'moved' (it
-- declined the decided date, and another was decided), 'undecided' (it
-- completed the answers, or declined the decided date, and every date has
-- a decline: the suggester picks), 'no_date', 'closed', 'past' (that date
-- has begun), 'not_invited', 'not_vote' or 'not_found'.
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
  v_chosen uuid;
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
  if v_status not in ('pending', 'scheduled') then
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

  if v_status = 'pending' then
    v_outcome := decide_vote(p_proposal_id, false);
    return case when v_outcome in ('scheduled', 'undecided', 'no_date') then v_outcome
                else 'answered' end;
  end if;

  -- Decided already: only "I can't make the decided date" moves it.
  select id into v_chosen
  from event_proposal_dates where proposal_id = p_proposal_id and chosen_at is not null;
  if p_response <> 'declined' or v_chosen is distinct from p_date_id then
    return 'answered';
  end if;

  update event_proposal_dates set chosen_at = null where proposal_id = p_proposal_id;
  update event_proposals set status = 'pending', updated_at = now() where id = p_proposal_id;
  delete from calendar_event_writes where proposal_id = p_proposal_id and not added;
  update calendar_event_writes
  set wanted = false, requeue = true, attempts = 0, last_error = null, updated_at = now()
  where proposal_id = p_proposal_id and added;

  v_outcome := decide_vote(p_proposal_id, true);
  return case v_outcome when 'scheduled' then 'moved' else v_outcome end;
end;
$$;

revoke execute on function respond_to_vote(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function respond_to_vote(uuid, uuid, uuid, text) to service_role;
