-- Sign in with Apple (#138): the one thing Casy keeps about it, a refresh
-- token per account, so the sign-in can be revoked at Apple when the account
-- is deleted (App Store requirement; see _shared/appleSignIn.ts).
--
-- Encrypted like every other credential (secretBox.ts, format v1:<nonce>:
-- <ciphertext>, refused otherwise), replaced by each new Apple sign-in, and
-- gone with the account (cascade) right after it has been revoked.
--
-- Safe to run twice.

create table if not exists apple_sign_ins (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  constraint apple_sign_ins_encrypted_check
    check (refresh_token ~ '^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$')
);

alter table apple_sign_ins enable row level security;

comment on table apple_sign_ins is
  'Encrypted Sign in with Apple refresh tokens, kept only to revoke the sign-in when the account is deleted. RLS denies all client-side access; only the service_role key (Edge Functions) can touch this table.';
