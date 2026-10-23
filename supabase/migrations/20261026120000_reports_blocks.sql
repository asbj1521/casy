-- Report and block (#142, App Store guideline 1.2): what people write in Casy
-- (group names, event names, places, notes, display names) is seen by others,
-- so anyone can report it, and block a person.
--
-- A report names what it is about (a group, an event, a member), a reason and
-- an optional note, and keeps a copy of the reported text as it was, made by
-- the groups function from the database, never from the reporter, so a later
-- edit can't hide what was reported. Admin mode lists reports without saying
-- who sent them; marking one handled deletes it. Reports also go with the
-- reporter's account (cascade) and 180 days after they were sent, nightly.
--
-- A block is one person never hearing from another again: their invitations
-- are skipped without a word (as for members and repeats, so the sender can't
-- tell), and pending ones are deleted when the block is made (the function).
-- It lasts until the person removes it in Your data, or either account goes.
--
-- Safe to run twice.

do $$
begin
  if to_regclass('public.group_invitations') is null then
    raise exception 'group_invitations is missing: apply 20261001120000_group_invitations first';
  end if;
  if to_regclass('public.event_proposals') is null then
    raise exception 'event_proposals is missing: apply 20260922120000_event_proposals first';
  end if;
end;
$$;

create table if not exists blocked_people (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_people_blocked_idx on blocked_people (blocked_id);

comment on table blocked_people is
  'Who blocked whom (#142): the blocked person''s invitations never reach the blocker. Removed in Your data, or with either account.';

alter table blocked_people enable row level security;

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('group', 'event', 'member')),
  group_id uuid references friend_groups (id) on delete set null,
  event_id uuid references event_proposals (id) on delete set null,
  member_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('spam', 'offensive', 'harassment', 'other')),
  note text check (char_length(note) <= 500),
  content jsonb not null default '{}'::jsonb check (pg_column_size(content) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists content_reports_reporter_idx on content_reports (reporter_id, created_at desc);
create index if not exists content_reports_created_idx on content_reports (created_at desc);

comment on table content_reports is
  'Reports of what people wrote (#142): the kind, reason, note, and a copy of the reported text made by the server. Admin mode lists them without the reporter. Deleted when handled, with the reporter''s account, and 180 days after sending.';

alter table content_reports enable row level security;

-- Invitations skip anyone who blocked the inviter, as quietly as members and
-- repeats: the answer counts only what was sent, which the page never shows.
create or replace function send_group_invitations(
  p_group_id uuid,
  p_inviter uuid,
  p_profile_ids uuid[],
  p_via_email boolean
)
returns int
language plpgsql
set search_path = public
as $$
declare
  sent int;
begin
  if not exists (
    select 1 from group_members where group_id = p_group_id and profile_id = p_inviter
  ) then
    raise exception 'You are not in that group.' using errcode = 'insufficient_privilege';
  end if;

  insert into group_invitations (group_id, profile_id, invited_by, via_email)
  select p_group_id, invitee, p_inviter, p_via_email
  from (select distinct unnest(p_profile_ids) as invitee) as picked
  where invitee <> p_inviter
    and not exists (
      select 1 from group_members m where m.group_id = p_group_id and m.profile_id = invitee
    )
    and not exists (
      select 1 from blocked_people b where b.blocker_id = invitee and b.blocked_id = p_inviter
    )
    and (
      select count(*) from group_invitations i where i.profile_id = invitee and i.status = 'pending'
    ) < 20
  on conflict (group_id, profile_id) do nothing;

  get diagnostics sent = row_count;
  return sent;
end;
$$;
revoke execute on function send_group_invitations(uuid, uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function send_group_invitations(uuid, uuid, uuid[], boolean) to service_role;

-- The 180 days, every night (UTC, beside the other cleanup). Scheduling under
-- a name it already has replaces that job.
select cron.schedule(
  'content-reports-180-days',
  '57 2 * * *',
  $job$ delete from public.content_reports where created_at < now() - interval '180 days'; $job$
);
