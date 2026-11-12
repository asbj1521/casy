-- "Påmind" on an open vote: its suggester reminds those who haven't answered,
-- by a push notification, at most once a day.
--
-- `event_proposals.reminded_at` is when it was last done; `remind_vote` does it
-- in one go (checks who may, stamps the time if a day has passed, queues a
-- notification for each person still to answer) and answers how many were
-- reminded. The notification is the `deadline_near` kind, topic `reminder`, so
-- the switch for "you haven't answered yet" covers both.

do $$
begin
  if to_regclass('public.push_queue') is null then
    raise exception 'remind_voters: push_queue is missing (apply the push notification migrations first)';
  end if;
  if to_regprocedure('push_enqueue(uuid, text, text, uuid, uuid, text)') is null then
    raise exception 'remind_voters: push_enqueue is missing';
  end if;
end;
$$;

alter table event_proposals add column if not exists reminded_at timestamptz;

-- The queue's topics, with `reminder` added (the constraint is replaced whole,
-- as search_vote_again did for `new_dates`).
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
    raise exception 'remind_voters: push_queue has no check on topic to replace';
  end if;
  execute format('alter table push_queue drop constraint %I', v_name);
end;
$$;

alter table push_queue add constraint push_queue_topic_check check (topic in
  ('invited', 'decided', 'no_date', 'choose', 'reopened', 'moved', 'cancelled',
   'group_invitation', 'deadline', 'new_dates', 'reminder'));

create or replace function remind_vote(p_proposal_id uuid, p_by uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_status text;
  v_mode text;
  v_optional jsonb;
  v_name text;
  v_who record;
  v_count int := 0;
begin
  select created_by, status, mode, coalesce(settings -> 'people' -> 'optional', '[]'::jsonb)
  into v_created_by, v_status, v_mode, v_optional
  from event_proposals where id = p_proposal_id;
  if not found then
    raise exception 'remind: no such event' using errcode = 'P0002';
  end if;
  if v_created_by is distinct from p_by then
    raise exception 'remind: not the suggester' using errcode = '42501';
  end if;
  if v_mode <> 'vote' or v_status <> 'pending' then
    raise exception 'remind: not waiting for answers' using errcode = '55000';
  end if;

  -- Once a day at most: stamped only if a day has passed, in the same statement.
  update event_proposals set reminded_at = now()
  where id = p_proposal_id
    and (reminded_at is null or reminded_at <= now() - interval '1 day');
  if not found then
    raise exception 'remind: already today' using errcode = '55P03';
  end if;

  select display_name into v_name from profiles where id = p_by;

  -- Everyone asked who still hasn't answered a date to come, but not the
  -- suggester and not those whose answer decides nothing (optional, #89).
  for v_who in
    select i.profile_id
    from event_invitees i
    where i.proposal_id = p_proposal_id
      and i.profile_id <> p_by
      and not (v_optional ? i.profile_id::text)
      and exists (
        select 1 from event_proposal_dates d
        where d.proposal_id = p_proposal_id and d.starts_at > now()
          and not exists (
            select 1 from event_responses r
            where r.date_id = d.id and r.profile_id = i.profile_id
          )
      )
  loop
    perform push_enqueue(v_who.profile_id, 'deadline_near', 'reminder', p_proposal_id, null, v_name);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function remind_vote(uuid, uuid) from public, anon, authenticated;
grant execute on function remind_vote(uuid, uuid) to service_role;
