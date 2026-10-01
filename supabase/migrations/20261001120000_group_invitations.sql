-- Inviting someone to a group from inside Casy, as well as by link: you pick
-- someone you already share a group with, or type the exact email of someone
-- with a Casy account. Nothing joins them: they accept or decline on My
-- events, because joining shows the group your name and when you're busy.
--
-- Locked down like every other table (RLS on, no policies). Only the `groups`
-- Edge Function touches these, as the service role, after checking the caller.

-- One open invitation per person per group. Accepting deletes the row and adds
-- the membership in one go (accept_group_invitation). Declining keeps the row
-- as 'declined', which blocks new invitations to that same group, so nobody
-- can be invited over and over; the person can still join with the group's
-- link if they change their mind, and joining clears the row.
--
-- via_email marks invitations that came from an email lookup. The function's
-- daily limit on picked people counts only the others: a limit counting
-- matched emails would give away which addresses have an account.
create table if not exists group_invitations (
  group_id uuid not null references friend_groups (id) on delete cascade,
  profile_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid references auth.users (id) on delete set null,
  via_email boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'declined')),
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

comment on table group_invitations is
  'Invitations to join a group, answered by the invited person. Declined rows stay and block re-invites to that group.';

-- "My invitations" is read on every page (the menu badge).
create index if not exists group_invitations_profile_id_idx
  on group_invitations (profile_id, status);

-- The daily limit on invitations someone sends.
create index if not exists group_invitations_invited_by_idx
  on group_invitations (invited_by, created_at);

-- One row per email address someone tried, matched or not, for the daily
-- limit on lookups. The address itself is never stored.
create table if not exists group_email_lookups (
  id bigint generated always as identity primary key,
  profile_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists group_email_lookups_profile_idx
  on group_email_lookups (profile_id, created_at);

comment on table group_email_lookups is
  'When someone looked up an email to invite, for a daily limit. Holds no email address.';

-- The account behind an email address, if there is one with that address
-- confirmed. Reads auth.users, which only this definer function may do; the
-- Edge Function never shows the answer to the person who asked.
create or replace function find_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
    and u.email_confirmed_at is not null
    and u.deleted_at is null
  limit 1;
$$;

-- Send invitations to a group, skipping without a word anyone who is the
-- inviter, already a member, already invited (or declined) to this group, or
-- holding 20 open invitations. Skipping silently matters for email lookups:
-- the inviter must get the same answer whatever was behind the address.
-- Returns how many were sent.
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
    and (
      select count(*) from group_invitations i where i.profile_id = invitee and i.status = 'pending'
    ) < 20
  on conflict (group_id, profile_id) do nothing;

  get diagnostics sent = row_count;
  return sent;
end;
$$;

-- Accept an open invitation: join the group (the member limits trigger still
-- applies, and its error reaches the person) and clear the invitation, in one
-- transaction. 'not_invited' if there's no open invitation, for example
-- because the group was deleted meanwhile.
create or replace function accept_group_invitation(p_group_id uuid, p_profile_id uuid)
returns text
language plpgsql
set search_path = public
as $$
begin
  perform 1 from group_invitations
  where group_id = p_group_id and profile_id = p_profile_id and status = 'pending'
  for update;
  if not found then
    return 'not_invited';
  end if;

  if not exists (
    select 1 from group_members where group_id = p_group_id and profile_id = p_profile_id
  ) then
    insert into group_members (group_id, profile_id) values (p_group_id, p_profile_id);
  end if;

  delete from group_invitations where group_id = p_group_id and profile_id = p_profile_id;
  return 'joined';
end;
$$;

-- Service role only, like every other function here.
revoke execute on function find_user_by_email(text) from public, anon, authenticated;
grant execute on function find_user_by_email(text) to service_role;
revoke execute on function send_group_invitations(uuid, uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function send_group_invitations(uuid, uuid, uuid[], boolean) to service_role;
revoke execute on function accept_group_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function accept_group_invitation(uuid, uuid) to service_role;

alter table group_invitations enable row level security;
alter table group_email_lookups enable row level security;
