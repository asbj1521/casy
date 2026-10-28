-- Push notifications (#139), the first part: the phones that may be sent one.
--
-- One row per phone that said yes in the app: Apple's token for it (which is
-- only good for sending to this app on that phone), the APNs server it last
-- worked on (an app run from Xcode is the sandbox's, TestFlight and the App
-- Store production's; null until a push went through), and the language its
-- notifications are written in. Signing in on the phone as someone else moves
-- the token to them; signing out deletes it, as does Apple saying the app is
-- gone, and the account (cascade).
--
-- Safe to run twice.

create table if not exists push_devices (
  token text primary key check (token ~ '^[0-9a-f]{64,200}$'),
  profile_id uuid not null references auth.users (id) on delete cascade,
  environment text check (environment in ('production', 'sandbox')),
  lang text not null default 'da' check (lang in ('da', 'en')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_profile_idx on push_devices (profile_id);

alter table push_devices enable row level security;

comment on table push_devices is
  'Phones that said yes to push notifications (#139). RLS denies all client-side access; only the service_role key (Edge Functions) can touch this table.';
