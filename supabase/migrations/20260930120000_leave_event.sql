-- Leaving one event: anyone invited except the person who suggested it (who
-- cancels instead) can drop out. A scheduled event carries on for everyone
-- else; a pending one becomes scheduled if everyone left has already said yes,
-- the same rule as someone leaving the group (leave_friend_group).
--
-- Answers:
--   'left'            removed; nothing else changed
--   'left_scheduled'  removed, and that made a pending event scheduled
--   'creator'         the suggester can't leave, only cancel
--   'closed'          cancelled, or never found a date: nothing to leave
--   'not_invited'     not (or no longer) invited
--   'not_found'       no such event
-- The event row is locked like respond_to_event does, so a leave and an
-- answer arriving together can't both judge the event from stale state.
create or replace function leave_event(p_proposal_id uuid, p_profile_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_creator uuid;
  v_after text;
begin
  select status, created_by into v_status, v_creator
  from event_proposals where id = p_proposal_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_creator = p_profile_id then
    return 'creator';
  end if;
  if v_status not in ('pending', 'scheduled') then
    return 'closed';
  end if;

  delete from event_invitees where proposal_id = p_proposal_id and profile_id = p_profile_id;
  if not found then
    return 'not_invited';
  end if;

  if v_status = 'pending' then
    perform refresh_event_status(p_proposal_id);
    select status into v_after from event_proposals where id = p_proposal_id;
    if v_after = 'scheduled' then
      return 'left_scheduled';
    end if;
  end if;
  return 'left';
end;
$$;

revoke execute on function leave_event(uuid, uuid) from public, anon, authenticated;
grant execute on function leave_event(uuid, uuid) to service_role;
