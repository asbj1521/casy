-- Adding a friend directly (#226): a link to send, whose holder taps to become
-- friends both ways. As with group_invites, only a fingerprint of the token is
-- kept, and any number of people can use a link for its seven days. Goes with
-- the account that made it.
do $$
begin
  if to_regclass('public.friends') is null then
    raise exception 'friends is missing: apply 20261105130000_friends first';
  end if;
  if to_regnamespace('cron') is null then
    raise exception 'pg_cron is missing: apply 20261008130000_cleanup_schedule first';
  end if;
end $$;

create table if not exists friend_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists friend_links_created_by_idx on friend_links (created_by, created_at);

comment on column friend_links.token_hash is
  'HMAC fingerprint of the friend link token (see _shared/secretBox.ts). The token itself exists only in the link.';

alter table friend_links enable row level security;

-- Kept as long as invite links: 30 days after they stopped working (the privacy policy).
select cron.schedule(
  'friend-links-cleanup',
  '20 3 * * *',
  $$delete from public.friend_links where expires_at < now() - interval '30 days'$$
);
