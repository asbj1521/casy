-- A place and a note on suggested events (#84), set when suggesting and
-- changed later by the suggester; and calendar entries that follow such a
-- change. Also lets a vote's deadline be chosen (#99): suggest_vote_event
-- already takes it, so only the Edge Function changes for that.
--
-- An entry Casy put into someone's calendar is never overwritten by an add
-- (calendarWrites.ts). After an edit, entries already added are marked
-- `refresh`: the next write replaces them in place (a PUT that only succeeds
-- if the entry is still there), so an entry the person deleted by hand stays
-- deleted, and one they added by hand stays. `added` stays true throughout,
-- because the entry is there: a cancel, a leave or a moved date arriving
-- before the refresh still takes it out as before.
--
-- Fails rather than guesses: suggest_vote_event must be the one swipe_dates made.

do $$
begin
  if to_regprocedure('public.suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz)') is null then
    raise exception 'suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz) not found: apply swipe_dates first';
  end if;
end;
$$;

alter table event_proposals
  add column place text check (place is null or char_length(btrim(place)) between 1 and 100),
  add column note text check (note is null or char_length(btrim(note)) between 1 and 500);

comment on column event_proposals.place is 'Where the group meets, as the suggester typed it; null if not given.';
comment on column event_proposals.note is 'What the others should know, as the suggester typed it; null if not given.';

alter table calendar_event_writes add column refresh boolean not null default false;

comment on column calendar_event_writes.refresh is
  'The event''s details changed while it was in the calendar (added): the next write replaces the entry in place.';

-- The same as before, with a place and a note. A new parameter list makes a
-- new function, so the old one goes first; the defaults keep a call without
-- them (an Edge Function deployed before this) working.
drop function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz);

create function suggest_vote_event(
  p_group_id uuid,
  p_created_by uuid,
  p_title text,
  p_settings jsonb,
  p_dates jsonb,
  p_answer_by timestamptz,
  p_place text default null,
  p_note text default null
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

  insert into event_proposals (group_id, created_by, title, settings, mode, answer_by, place, note)
  values (p_group_id, p_created_by, p_title, p_settings, 'vote', p_answer_by, p_place, p_note)
  returning id into v_proposal;

  insert into event_proposal_dates (proposal_id, starts_at, ends_at)
  select v_proposal, (e ->> 'start')::timestamptz, (e ->> 'end')::timestamptz
  from jsonb_array_elements(p_dates) e;

  insert into event_invitees (proposal_id, profile_id)
  select v_proposal, profile_id from group_members where group_id = p_group_id;

  return v_proposal;
end;
$$;

-- The suggester changes the place and the note (null clears one), with the
-- event locked. Entries already in people's calendars are marked to be
-- replaced with the new details.
--
-- Returns 'edited', 'not_creator', 'closed' (cancelled) or 'not_found'.
create function edit_event_details(
  p_proposal_id uuid,
  p_profile_id uuid,
  p_place text,
  p_note text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_creator uuid;
  v_status text;
begin
  select created_by, status into v_creator, v_status
  from event_proposals where id = p_proposal_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_creator is distinct from p_profile_id then
    return 'not_creator';
  end if;
  if v_status = 'cancelled' then
    return 'closed';
  end if;

  update event_proposals
  set place = p_place, note = p_note, updated_at = now()
  where id = p_proposal_id;

  update calendar_event_writes
  set refresh = true, attempts = 0, last_error = null, updated_at = now()
  where proposal_id = p_proposal_id and wanted and added;

  return 'edited';
end;
$$;

-- Service role only, like every other event function.
revoke execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text)
  to service_role;
revoke execute on function edit_event_details(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function edit_event_details(uuid, uuid, text, text) to service_role;
