-- Searching an open vote again (#240): anyone in the group can add the members
-- the vote left out and look for new dates for everyone, the new people's
-- calendars counted too, or simply search again when no date suits everyone.
--
-- search_vote_again does it in one transaction: a date offered again unchanged
-- keeps its answers, every other date goes (its answers with it), the new
-- dates come in unanswered, the settings are replaced (who it is for), those
-- already asked are told there are new dates, and the people added are
-- invited, which push_on_invitee tells them as for any vote. The vote stays
-- open; its deadline stays as it was.
--
-- Outcomes, for the events function to turn into answers: 'searched',
-- 'not_found', 'not_member' (the caller isn't in the group), 'closed' (not an
-- open vote), 'outsider' (someone added isn't in the group).
--
-- Fails rather than guesses: what this builds on must be there.

do $$
begin
  if to_regprocedure('public.push_enqueue(uuid, text, text, uuid, uuid, text)') is null
    or to_regprocedure('public.decide_vote(uuid, boolean)') is null then
    raise exception 'search_vote_again: apply push_notifications and participants first';
  end if;
end;
$$;

-- The notification "new dates" (#240) joins the topics a queued push may have.
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.push_queue'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%topic%';
  if v_name is null then
    raise exception 'search_vote_again: push_queue has no check on topic to replace';
  end if;
  execute format('alter table push_queue drop constraint %I', v_name);
end;
$$;

alter table push_queue add constraint push_queue_topic_check check (topic in
  ('invited', 'decided', 'no_date', 'choose', 'reopened', 'moved', 'cancelled',
   'group_invitation', 'deadline', 'new_dates'));

create or replace function search_vote_again(
  p_proposal_id uuid,
  p_by uuid,
  p_add uuid[],
  p_settings jsonb,
  p_dates jsonb
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_group uuid;
  v_status text;
  v_mode text;
  v_name text;
  v_who record;
begin
  if jsonb_typeof(p_dates) is distinct from 'array' or jsonb_array_length(p_dates) = 0 then
    raise exception 'A vote needs at least one date';
  end if;

  -- Held until the end, so two people searching at once don't mix their dates.
  select group_id, status, mode into v_group, v_status, v_mode
  from event_proposals where id = p_proposal_id
  for update;
  if v_group is null then return 'not_found'; end if;
  if not exists (
    select 1 from group_members where group_id = v_group and profile_id = p_by
  ) then
    return 'not_member';
  end if;
  if v_status is distinct from 'pending' or v_mode is distinct from 'vote' then
    return 'closed';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_add, '{}'::uuid[])) a
    where not exists (select 1 from group_members where group_id = v_group and profile_id = a)
  ) then
    return 'outsider';
  end if;

  -- A date offered again unchanged keeps its answers; the others go, answers with them.
  delete from event_proposal_dates d
  where d.proposal_id = p_proposal_id
    and not exists (
      select 1 from jsonb_array_elements(p_dates) e
      where (e ->> 'start')::timestamptz = d.starts_at
        and (e ->> 'end')::timestamptz = d.ends_at
    );
  insert into event_proposal_dates (proposal_id, starts_at, ends_at)
  select p_proposal_id, (e ->> 'start')::timestamptz, (e ->> 'end')::timestamptz
  from jsonb_array_elements(p_dates) e
  where not exists (
    select 1 from event_proposal_dates d
    where d.proposal_id = p_proposal_id
      and d.starts_at = (e ->> 'start')::timestamptz
      and d.ends_at = (e ->> 'end')::timestamptz
  );

  update event_proposals
  set settings = p_settings, updated_at = now()
  where id = p_proposal_id;

  -- Told before the new people come in, so only those already asked hear of
  -- new dates; the new people get the invitation instead.
  select display_name into v_name from profiles where id = p_by;
  for v_who in
    select profile_id from event_invitees
    where proposal_id = p_proposal_id and profile_id is distinct from p_by
  loop
    perform push_enqueue(v_who.profile_id, 'event_changed', 'new_dates', p_proposal_id, null, v_name);
  end loop;

  insert into event_invitees (proposal_id, profile_id)
  select p_proposal_id, a from unnest(coalesce(p_add, '{}'::uuid[])) a
  on conflict do nothing;

  return 'searched';
end;
$$;

-- Service role only, like every other event function.
revoke execute on function search_vote_again(uuid, uuid, uuid[], jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function search_vote_again(uuid, uuid, uuid[], jsonb, jsonb) to service_role;
