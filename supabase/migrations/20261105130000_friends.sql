-- Who has shared a group with whom (#222), so people stay invitable after a
-- group is gone. One row per direction, so "my friends" is one simple read.
-- Filled by a trigger as people join, and from today's groups below; groups
-- already deleted left no record, so those friendships can't be recovered.
create table if not exists friends (
  profile_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, friend_id),
  check (profile_id <> friend_id)
);

create index if not exists friends_friend_idx on friends (friend_id);

comment on table friends is
  'Who has shared a group with whom (#222): who may invite whom, with their yes still needed to join. Kept until either removes the other or deletes their account. Blocking (blocked_people) always wins.';

alter table friends enable row level security;

insert into friends (profile_id, friend_id)
select a.profile_id, b.profile_id
from group_members a
join group_members b on a.group_id = b.group_id and a.profile_id <> b.profile_id
on conflict do nothing;

create or replace function remember_group_friends() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into friends (profile_id, friend_id)
  select new.profile_id, m.profile_id
  from group_members m
  where m.group_id = new.group_id and m.profile_id <> new.profile_id
  on conflict do nothing;

  insert into friends (profile_id, friend_id)
  select m.profile_id, new.profile_id
  from group_members m
  where m.group_id = new.group_id and m.profile_id <> new.profile_id
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function remember_group_friends() from public, anon, authenticated;

drop trigger if exists group_members_remember_friends on group_members;
create trigger group_members_remember_friends
  after insert on group_members
  for each row execute function remember_group_friends();
