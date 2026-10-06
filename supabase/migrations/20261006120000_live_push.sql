-- Pushing "something changed" to open pages, so they don't have to keep asking.
--
-- Every write to a table live_pulse() reads tells the people it concerns, over
-- Supabase Realtime: an empty broadcast with the event "pulse" on the private
-- topic pulse:<their user id>. The message carries no data at all; the page
-- then asks live_pulse() through the groups function as before, and fetches
-- the real data through the functions only if the pulse moved. The browser
-- still never reads a table.
--
-- Triggers rather than the Edge Functions sending it, for the same reason
-- live_pulse() hashes rows: no write anywhere has to remember to announce
-- itself (the hourly sync, every SQL function, and cascades are all covered).
-- realtime.send() writes to realtime.messages, which Realtime reads from the
-- write-ahead log, so a message only goes out once its transaction commits:
-- a write that rolls back announces nothing.
--
-- Each person is sent at most one message per transaction, however many rows
-- it touched (suggesting an event writes three tables; deleting a group
-- cascades through all of them), remembered in a transaction-local setting.
-- A failure to send is only a warning: it must never stop the write itself.
-- Pages also still ask the pulse now and then, so a lost message only delays.

do $$
begin
  if to_regprocedure('realtime.send(jsonb, text, text, boolean)') is null then
    raise exception 'realtime.send(jsonb, text, text, boolean) is missing: '
      'this project has no Realtime broadcast from the database';
  end if;
  if to_regclass('realtime.messages') is null then
    raise exception 'realtime.messages is missing';
  end if;
end $$;

-- Everyone in a group (null for none).
create or replace function group_people(p_group_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array_agg(profile_id) from group_members where group_id = p_group_id;
$$;

-- Tell each of these people their pulse may have moved, once per transaction.
create or replace function pulse_people(p_profile_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent text := coalesce(current_setting('casy.pulsed', true), '');
  v_id uuid;
begin
  foreach v_id in array coalesce(p_profile_ids, '{}') loop
    continue when v_id is null or position(v_id::text in v_sent) > 0;
    perform realtime.send('{}'::jsonb, 'pulse', 'pulse:' || v_id::text, true);
    v_sent := v_sent || ',' || v_id::text;
  end loop;
  perform set_config('casy.pulsed', v_sent, true);
exception when others then
  raise warning 'pulse_people failed: %', sqlerrm;
end;
$$;

-- Who a changed row concerns: the same people whose live_pulse() it is in.
create or replace function pulse_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_people uuid[];
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;

  case tg_table_name
    when 'friend_groups' then
      v_people := group_people(r.id);
    -- The person themself too: someone who just left is no longer in
    -- group_members, and a deleted group's members are only reached this way.
    when 'group_members', 'group_invitations' then
      v_people := group_people(r.group_id) || r.profile_id;
    when 'profiles' then
      select array_agg(distinct other.profile_id) into v_people
      from group_members mine
      join group_members other on other.group_id = mine.group_id
      where mine.profile_id = r.id;
    when 'event_proposals' then
      v_people := group_people(r.group_id);
    when 'event_proposal_dates', 'event_invitees' then
      v_people := group_people((select group_id from event_proposals where id = r.proposal_id));
    when 'event_responses' then
      v_people := group_people((
        select p.group_id
        from event_proposal_dates d
        join event_proposals p on p.id = d.proposal_id
        where d.id = r.date_id
      ));
    when 'calendar_event_writes' then
      v_people := array[r.profile_id];
  end case;

  perform pulse_people(v_people);
  return null;
-- Telling people is a courtesy: whatever goes wrong here, the write stands.
exception when others then
  raise warning 'pulse_on_change on % failed: %', tg_table_name, sqlerrm;
  return null;
end;
$$;

-- Called by the triggers only, never through the API.
revoke execute on function group_people(uuid) from public, anon, authenticated;
revoke execute on function pulse_people(uuid[]) from public, anon, authenticated;
revoke execute on function pulse_on_change() from public, anon, authenticated;

create trigger pulse_friend_groups
  after insert or update or delete on friend_groups
  for each row execute function pulse_on_change();

create trigger pulse_group_members
  after insert or update or delete on group_members
  for each row execute function pulse_on_change();

create trigger pulse_group_invitations
  after insert or update or delete on group_invitations
  for each row execute function pulse_on_change();

-- Only a new name matters: remember_login_name() rewrites the row on almost
-- every visit, and a new profile is in no group yet.
create trigger pulse_profiles
  after update on profiles
  for each row
  when (old.display_name is distinct from new.display_name)
  execute function pulse_on_change();

create trigger pulse_event_proposals
  after insert or update or delete on event_proposals
  for each row execute function pulse_on_change();

create trigger pulse_event_proposal_dates
  after insert or update or delete on event_proposal_dates
  for each row execute function pulse_on_change();

create trigger pulse_event_invitees
  after insert or update or delete on event_invitees
  for each row execute function pulse_on_change();

create trigger pulse_event_responses
  after insert or update or delete on event_responses
  for each row execute function pulse_on_change();

-- The sync retries rewrite attempts and errors; only what live_pulse() reads
-- (added, gone_at) is worth a message.
create trigger pulse_calendar_event_writes
  after insert or delete on calendar_event_writes
  for each row execute function pulse_on_change();

create trigger pulse_calendar_event_writes_update
  after update on calendar_event_writes
  for each row
  when (old.added is distinct from new.added or old.gone_at is distinct from new.gone_at)
  execute function pulse_on_change();

-- Who may listen: a signed-in person, to their own topic only, and only to
-- broadcasts. No insert policy, so no browser can send on any topic. This is
-- Realtime's own table; Casy's tables keep no policies at all.
create policy "casy: receive your own pulse"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'pulse:' || (select auth.uid())::text
  );
