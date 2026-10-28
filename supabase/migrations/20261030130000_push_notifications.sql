-- Push notifications (#139), the second part: what is sent, and when.
-- Needs push_devices (20261030120000_push_devices).
--
-- Five kinds, each a switch in Settings (push_settings keeps the ones switched
-- OFF, so a new kind is on for everyone):
--   vote_invited     someone suggested dates to you
--   vote_decided     the date is set, no date fits, or all dates have a no
--                    and you choose
--   event_changed    a date fell through and the vote is open again, the date
--                    moved, or the event was cancelled
--   group_invitation someone invited you to a group
--   deadline_near    a vote's deadline is within a day and you have not answered
--
-- Triggers write a row to push_queue, in the same transaction as the change:
-- a write that rolls back sends nothing, and no code that changes an event
-- has to remember to announce it. A row is only made for someone with a phone
-- that said yes and the kind switched on. The push Edge Function is told
-- (pg_net, after the commit) and takes the rows, writes each notification in
-- the phone's language and sends it. A claimed row is deleted, and put back
-- once or twice if Apple could not be reached, so a notification is sent at
-- most once, and the queue only ever holds what is waiting.
--
-- The call to the function reuses the hourly sync's Vault secrets
-- (calendar_sync_url and calendar_sync_secret): the function is next to
-- calendar-sync, and the secret only proves the call comes from this
-- database. Nothing new to create by hand. A failure to send is only a
-- warning: it must never stop the write itself.
--
-- Safe to run twice.

do $$
begin
  if to_regclass('public.push_devices') is null then
    raise exception 'push_devices is missing: apply 20261030120000_push_devices first';
  end if;
  if to_regclass('public.event_proposals') is null or to_regclass('public.group_invitations') is null then
    raise exception 'event_proposals or group_invitations is missing';
  end if;
  if to_regprocedure('decide_vote(uuid, boolean)') is null then
    raise exception 'decide_vote(uuid, boolean) is missing: apply 20261007120000_swipe_dates first';
  end if;
end $$;

-- Which kinds a person switched off in Settings.
create table if not exists push_settings (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  off text[] not null default '{}'
    check (off <@ array['vote_invited', 'vote_decided', 'event_changed', 'group_invitation', 'deadline_near']::text[]),
  updated_at timestamptz not null default now()
);
alter table push_settings enable row level security;

-- Votes already reminded of, and already asking their suggester to choose.
alter table event_proposals add column if not exists deadline_pushed_at timestamptz;
alter table event_proposals add column if not exists choose_pushed_at timestamptz;

-- Notifications waiting to be sent. `topic` is the exact wording, `kind` the
-- switch it belongs to.
create table if not exists push_queue (
  id bigint generated always as identity primary key,
  profile_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in
    ('vote_invited', 'vote_decided', 'event_changed', 'group_invitation', 'deadline_near')),
  topic text not null check (topic in
    ('invited', 'decided', 'no_date', 'choose', 'reopened', 'moved', 'cancelled',
     'group_invitation', 'deadline')),
  proposal_id uuid references event_proposals (id) on delete cascade,
  group_id uuid references friend_groups (id) on delete cascade,
  -- The name of whoever did it, if a person did, as it was then.
  actor_name text,
  -- The transaction that made it, so "reopened, then decided again" can say "moved".
  txid bigint not null default txid_current(),
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists push_queue_proposal_idx on push_queue (proposal_id, txid);
alter table push_queue enable row level security;

comment on table push_settings is
  'Notification kinds a person switched off (#139). RLS denies all client-side access; only the service_role key (Edge Functions) can touch this table.';
comment on table push_queue is
  'Push notifications waiting to be sent (#139): made by triggers, claimed and deleted by the push function. Nothing is kept once sent.';

-- A row for one person, if they have a phone that said yes and the kind on.
create or replace function push_enqueue(
  p_profile_id uuid,
  p_kind text,
  p_topic text,
  p_proposal_id uuid,
  p_group_id uuid,
  p_actor_name text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id is null then return; end if;
  if not exists (select 1 from push_devices where profile_id = p_profile_id) then return; end if;
  if exists (select 1 from push_settings where profile_id = p_profile_id and p_kind = any (off)) then
    return;
  end if;
  insert into push_queue (profile_id, kind, topic, proposal_id, group_id, actor_name)
  values (p_profile_id, p_kind, p_topic, p_proposal_id, p_group_id, p_actor_name);
end;
$$;

-- Whoever answered an event in the last few seconds: the one whose answer
-- just decided or reopened it, who needs no notification about it.
create or replace function push_recent_answerer(p_proposal_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.profile_id
  from event_responses r
  join event_proposal_dates d on d.id = r.date_id
  where d.proposal_id = p_proposal_id and r.responded_at > now() - interval '10 seconds'
  order by r.responded_at desc
  limit 1;
$$;

-- Someone was asked to vote.
create or replace function push_on_invitee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_status text;
  v_mode text;
begin
  select created_by, status, mode into v_creator, v_status, v_mode
  from event_proposals where id = new.proposal_id;
  if v_status = 'pending' and v_mode = 'vote' and new.profile_id is distinct from v_creator then
    perform push_enqueue(
      new.profile_id, 'vote_invited', 'invited', new.proposal_id, null,
      (select display_name from profiles where id = v_creator)
    );
  end if;
  return new;
exception when others then
  raise warning 'push_on_invitee failed: %', sqlerrm;
  return new;
end;
$$;

-- An event changed state: decided, no date fits, reopened, or cancelled.
create or replace function push_on_proposal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_who record;
  v_answerer uuid;
begin
  if new.status = old.status or new.mode is distinct from 'vote' then return new; end if;
  v_answerer := push_recent_answerer(new.id);

  if new.status = 'scheduled' then
    -- Reopened and decided again in one go: one notification, "moved".
    if exists (
      select 1 from push_queue where proposal_id = new.id and topic = 'reopened' and txid = txid_current()
    ) then
      update push_queue set topic = 'moved'
      where proposal_id = new.id and topic = 'reopened' and txid = txid_current();
      return new;
    end if;
    for v_who in
      select profile_id from event_invitees
      where proposal_id = new.id and profile_id is distinct from v_answerer
    loop
      perform push_enqueue(v_who.profile_id, 'vote_decided', 'decided', new.id, null, null);
    end loop;
  elsif new.status = 'no_date' then
    for v_who in select profile_id from event_invitees where proposal_id = new.id loop
      perform push_enqueue(v_who.profile_id, 'vote_decided', 'no_date', new.id, null, null);
    end loop;
  elsif new.status = 'pending' and old.status = 'scheduled' then
    for v_who in
      select profile_id from event_invitees
      where proposal_id = new.id and profile_id is distinct from v_answerer
    loop
      perform push_enqueue(v_who.profile_id, 'event_changed', 'reopened', new.id, null, null);
    end loop;
  elsif new.status = 'cancelled' then
    for v_who in
      select profile_id from event_invitees
      where proposal_id = new.id and profile_id is distinct from new.created_by
    loop
      perform push_enqueue(
        v_who.profile_id, 'event_changed', 'cancelled', new.id, null,
        (select display_name from profiles where id = new.created_by)
      );
    end loop;
  end if;
  return new;
exception when others then
  raise warning 'push_on_proposal_status failed: %', sqlerrm;
  return new;
end;
$$;

-- Someone was invited to a group.
create or replace function push_on_group_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform push_enqueue(
      new.profile_id, 'group_invitation', 'group_invitation', null, new.group_id,
      (select display_name from profiles where id = new.invited_by)
    );
  end if;
  return new;
exception when others then
  raise warning 'push_on_group_invitation failed: %', sqlerrm;
  return new;
end;
$$;

-- Tell the push function there is something to send: once per statement that
-- queued anything, after the commit (pg_net keeps its requests in the
-- transaction until then).
create or replace function push_kick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := replace(
      (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_sync_url'),
      '/calendar-sync', '/push'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_sync_secret')
    ),
    body := '{}'::jsonb
  );
  return null;
exception when others then
  raise warning 'push_kick failed: %', sqlerrm;
  return null;
end;
$$;

-- The next notifications to send, taken off the queue (several callers at
-- once never get the same row).
create or replace function push_claim(p_limit int)
returns setof push_queue
language sql
security definer
set search_path = public
as $$
  delete from push_queue
  where id in (select id from push_queue order by id limit p_limit for update skip locked)
  returning *;
$$;

-- Every 15 minutes: decide the votes whose deadline has passed (so "the date
-- is set" doesn't wait for someone to open the app), ask a suggester to
-- choose when every date has a no, and remind people of a deadline within a
-- day. Each vote at most once for each.
create or replace function push_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote record;
  v_who record;
  v_outcome text;
begin
  for v_vote in
    select id, created_by, choose_pushed_at from event_proposals
    where mode = 'vote' and status = 'pending' and answer_by is not null and answer_by <= now()
  loop
    begin
      v_outcome := decide_vote(v_vote.id, false);
      if v_outcome = 'undecided' and v_vote.choose_pushed_at is null then
        update event_proposals set choose_pushed_at = now() where id = v_vote.id;
        perform push_enqueue(v_vote.created_by, 'vote_decided', 'choose', v_vote.id, null, null);
      end if;
    exception when others then
      raise warning 'push_sweep could not decide %: %', v_vote.id, sqlerrm;
    end;
  end loop;

  for v_vote in
    update event_proposals set deadline_pushed_at = now()
    where mode = 'vote' and status = 'pending' and deadline_pushed_at is null
      and answer_by > now() and answer_by <= now() + interval '24 hours'
    returning id
  loop
    for v_who in
      select i.profile_id
      from event_invitees i
      where i.proposal_id = v_vote.id
        and exists (
          select 1 from event_proposal_dates d
          where d.proposal_id = v_vote.id and d.starts_at > now()
            and not exists (
              select 1 from event_responses r where r.date_id = d.id and r.profile_id = i.profile_id
            )
        )
    loop
      perform push_enqueue(v_who.profile_id, 'deadline_near', 'deadline', v_vote.id, null, null);
    end loop;
  end loop;

  -- Nothing waits longer than a day: a notification that old is no use.
  delete from push_queue where created_at < now() - interval '1 day';
end;
$$;

drop trigger if exists push_event_invitees on event_invitees;
create trigger push_event_invitees
  after insert on event_invitees
  for each row execute function push_on_invitee();

drop trigger if exists push_event_proposals on event_proposals;
create trigger push_event_proposals
  after update of status on event_proposals
  for each row execute function push_on_proposal_status();

drop trigger if exists push_group_invitations on group_invitations;
create trigger push_group_invitations
  after insert on group_invitations
  for each row execute function push_on_group_invitation();

drop trigger if exists push_queue_kick on push_queue;
create trigger push_queue_kick
  after insert on push_queue
  for each statement execute function push_kick();

-- Service role only, like every other function here.
revoke execute on function push_enqueue(uuid, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function push_recent_answerer(uuid) from public, anon, authenticated;
revoke execute on function push_on_invitee() from public, anon, authenticated;
revoke execute on function push_on_proposal_status() from public, anon, authenticated;
revoke execute on function push_on_group_invitation() from public, anon, authenticated;
revoke execute on function push_kick() from public, anon, authenticated;
revoke execute on function push_claim(int) from public, anon, authenticated;
revoke execute on function push_sweep() from public, anon, authenticated;
grant execute on function push_claim(int) to service_role;

select cron.schedule('push-sweep', '*/15 * * * *', $job$ select push_sweep(); $job$);
