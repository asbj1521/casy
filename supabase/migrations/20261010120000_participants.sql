-- Who an event is for (#89). A vote's settings may name its people
-- (settings.people): the members invited, the optional ones among them,
-- and for a meeting "at least N" of the required ones. The browser searches
-- by the same rules (src/lib/eventSearch.ts) and shows the same decision
-- (src/lib/vote.ts); this is the decision that counts.
--
--   - Only the members named are invited (suggest_vote_event, p_members;
--     null invites the whole group, as before).
--   - Optional members are invited and answer, but never block a date and
--     are never waited for.
--   - Without "at least N": the date no required member declined, with the
--     fewest required "maybe", earliest first (as before, optional aside).
--   - With it: a date at least N required members can make (yes or maybe);
--     the one most people can make, then the fewest required "maybe", then
--     the earliest.
--   - Whoever declined the date chosen is taken off the event (as choosing a
--     date by hand already does), and out of their calendar.
--   - After a decision, a "no" to the chosen date from an optional member, or
--     from a required one while enough are still coming, takes only them off;
--     otherwise the vote opens again, as before.
--
-- Fails rather than guesses: the functions this replaces must be there.

do $$
begin
  if to_regprocedure('public.suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text)') is null
    or to_regprocedure('public.decide_vote(uuid, boolean)') is null
    or to_regprocedure('public.respond_to_vote(uuid, uuid, uuid, text)') is null then
    raise exception 'participants: apply event_place_note and change_vote_answers first';
  end if;
end;
$$;

-- The optional members of an event, from its settings.
create function event_optional(p_settings jsonb)
returns uuid[]
language sql
immutable
as $$
  select coalesce(
    array(select x::uuid from jsonb_array_elements_text(p_settings -> 'people' -> 'optional') x),
    '{}'::uuid[]
  );
$$;

-- Someone no longer coming to an event: off it, and out of their calendar
-- (an entry already added is taken out by the next write; one not yet added
-- is dropped), as leave_event does.
create function drop_invitee(p_proposal_id uuid, p_profile_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from event_invitees where proposal_id = p_proposal_id and profile_id = p_profile_id;
  delete from calendar_event_writes
  where proposal_id = p_proposal_id and profile_id = p_profile_id and not added;
  update calendar_event_writes
  set wanted = false, refresh = false, attempts = 0, last_error = null, updated_at = now()
  where proposal_id = p_proposal_id and profile_id = p_profile_id and added;
end;
$$;

drop function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text);

create function suggest_vote_event(
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

  return v_proposal;
end;
$$;

create or replace function decide_vote(p_proposal_id uuid, p_force boolean)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_mode text;
  v_answer_by timestamptz;
  v_settings jsonb;
  v_optional uuid[];
  v_at_least int;
  v_missing int;
  v_winner uuid;
begin
  select status, mode, answer_by, settings into v_status, v_mode, v_answer_by, v_settings
  from event_proposals where id = p_proposal_id;
  if v_status is distinct from 'pending' or v_mode is distinct from 'vote' then
    return 'closed';
  end if;
  v_optional := event_optional(v_settings);
  v_at_least := (v_settings -> 'people' ->> 'atLeast')::int;

  if not exists (
    select 1 from event_proposal_dates
    where proposal_id = p_proposal_id and starts_at > now()
  ) then
    update event_proposals set status = 'no_date', updated_at = now() where id = p_proposal_id;
    return 'no_date';
  end if;

  -- Answers still owed: a required member with no answer on a date to come.
  select count(*) into v_missing
  from event_invitees i
  join event_proposal_dates d on d.proposal_id = i.proposal_id
  where i.proposal_id = p_proposal_id
    and not (i.profile_id = any(v_optional))
    and d.starts_at > now()
    and not exists (
      select 1 from event_responses r where r.date_id = d.id and r.profile_id = i.profile_id
    );
  if v_missing > 0 and not p_force and (v_answer_by is null or v_answer_by > now()) then
    return 'open';
  end if;

  -- Only the answers of people still invited count: someone who left the
  -- event or the group no longer has a say.
  if v_at_least is null then
    select d.id into v_winner
    from event_proposal_dates d
    where d.proposal_id = p_proposal_id
      and d.starts_at > now()
      and not exists (
        select 1
        from event_responses r
        join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
        where r.date_id = d.id and r.response = 'declined' and not (r.profile_id = any(v_optional))
      )
    order by
      (
        select count(*)
        from event_responses r
        join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
        where r.date_id = d.id and r.response = 'maybe' and not (r.profile_id = any(v_optional))
      ),
      d.starts_at
    limit 1;
  else
    select d.id into v_winner
    from event_proposal_dates d
    where d.proposal_id = p_proposal_id
      and d.starts_at > now()
      and (
        select count(*)
        from event_responses r
        join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
        where r.date_id = d.id
          and r.response in ('accepted', 'maybe')
          and not (r.profile_id = any(v_optional))
      ) >= v_at_least
    order by
      (
        select count(*)
        from event_responses r
        join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
        where r.date_id = d.id and r.response in ('accepted', 'maybe')
      ) desc,
      (
        select count(*)
        from event_responses r
        join event_invitees i on i.proposal_id = d.proposal_id and i.profile_id = r.profile_id
        where r.date_id = d.id and r.response = 'maybe' and not (r.profile_id = any(v_optional))
      ),
      d.starts_at
    limit 1;
  end if;

  if v_winner is null then
    return 'undecided';
  end if;

  update event_proposal_dates set chosen_at = now() where id = v_winner;
  update event_proposals set status = 'scheduled', updated_at = now() where id = p_proposal_id;

  -- Whoever said no to the date chosen isn't coming: off the event.
  perform drop_invitee(p_proposal_id, r.profile_id)
  from event_responses r
  join event_invitees i on i.proposal_id = p_proposal_id and i.profile_id = r.profile_id
  where r.date_id = v_winner and r.response = 'declined';
  return 'scheduled';
end;
$$;

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
  v_settings jsonb;
  v_starts timestamptz;
  v_chosen uuid;
  v_outcome text;
  v_at_least int;
  v_coming int;
begin
  if p_response not in ('accepted', 'maybe', 'declined') then
    raise exception 'Unknown response %', p_response;
  end if;

  select status, mode, settings into v_status, v_mode, v_settings
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

  -- Decided already: only "I can't make the decided date" changes anything.
  select id into v_chosen
  from event_proposal_dates where proposal_id = p_proposal_id and chosen_at is not null;
  if p_response <> 'declined' or v_chosen is distinct from p_date_id then
    return 'answered';
  end if;

  -- An optional member, or a required one while enough are still coming:
  -- only they are off it.
  v_at_least := (v_settings -> 'people' ->> 'atLeast')::int;
  if p_profile_id = any(event_optional(v_settings)) then
    perform drop_invitee(p_proposal_id, p_profile_id);
    return 'answered';
  end if;
  if v_at_least is not null then
    select count(*) into v_coming
    from event_responses r
    join event_invitees i on i.proposal_id = p_proposal_id and i.profile_id = r.profile_id
    where r.date_id = v_chosen
      and r.response in ('accepted', 'maybe')
      and not (r.profile_id = any(event_optional(v_settings)));
    if v_coming >= v_at_least then
      perform drop_invitee(p_proposal_id, p_profile_id);
      return 'answered';
    end if;
  end if;

  -- Otherwise the date no longer works: the vote opens again, as before.
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

-- Service role only, like every other event function.
revoke execute on function event_optional(jsonb) from public, anon, authenticated;
revoke execute on function drop_invitee(uuid, uuid) from public, anon, authenticated;
revoke execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text, uuid[])
  from public, anon, authenticated;
grant execute on function suggest_vote_event(uuid, uuid, text, jsonb, jsonb, timestamptz, text, text, uuid[])
  to service_role;
revoke execute on function decide_vote(uuid, boolean) from public, anon, authenticated;
revoke execute on function respond_to_vote(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function respond_to_vote(uuid, uuid, uuid, text) to service_role;
