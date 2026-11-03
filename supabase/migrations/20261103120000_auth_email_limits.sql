-- Auth emails limited without a CAPTCHA (#203). The sign-in page must work
-- with any ad blocker, so the protection against a script making Casy send
-- sign-in emails to many addresses lives in the auth-email hook, which sends
-- every one: at most so many per address and so many in all per hour
-- (_shared/authEmailLimits.ts holds the numbers).
--
-- Only an HMAC of the address is kept (made with the hook's own secret, so it
-- can't be turned back into the address), with when the email went, and only
-- for a day: the privacy policy says so.

create table if not exists auth_email_sends (
  id bigint generated always as identity primary key,
  recipient text not null check (recipient ~ '^[0-9a-f]{64}$'),
  sent_at timestamptz not null default now()
);

create index if not exists auth_email_sends_recipient_idx
  on auth_email_sends (recipient, sent_at);
create index if not exists auth_email_sends_sent_at_idx
  on auth_email_sends (sent_at);

-- RLS on with no policies, as every table: only the hook, as the service
-- role, reads or writes it.
alter table auth_email_sends enable row level security;

-- Claim one email to `p_recipient` (an HMAC, hex): {"ok": true} and it is
-- counted, or {"exhausted": "address"} (that address had its share this hour
-- or day) or {"exhausted": "all"} (the hour's share for everyone is used).
-- Rows over a day old go first, so the counts only ever see the last day.
create or replace function claim_auth_email(
  p_recipient text,
  p_per_hour int,
  p_per_day int,
  p_all_per_hour int
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_hour int;
  v_day int;
begin
  if p_recipient is null or p_recipient !~ '^[0-9a-f]{64}$' then
    raise exception 'claim_auth_email: p_recipient must be a hex HMAC';
  end if;
  if p_per_hour is null or p_per_hour < 1 or p_per_day is null or p_per_day < 1
     or p_all_per_hour is null or p_all_per_hour < 1 then
    raise exception 'claim_auth_email: limits must be 1 or more';
  end if;

  perform pg_advisory_xact_lock(hashtext('claim_auth_email'));

  delete from auth_email_sends where sent_at < now() - interval '1 day';

  select count(*) filter (where sent_at >= now() - interval '1 hour'), count(*)
    into v_hour, v_day
  from auth_email_sends
  where recipient = p_recipient;
  if v_hour >= p_per_hour or v_day >= p_per_day then
    return jsonb_build_object('exhausted', 'address');
  end if;

  if (select count(*) from auth_email_sends where sent_at >= now() - interval '1 hour')
     >= p_all_per_hour then
    return jsonb_build_object('exhausted', 'all');
  end if;

  insert into auth_email_sends (recipient) values (p_recipient);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function claim_auth_email(text, int, int, int) from public, anon, authenticated;
grant execute on function claim_auth_email(text, int, int, int) to service_role;

-- A day with no auth email at all would leave the last rows behind: the
-- nightly job takes them, so none outlives the day the privacy policy says.
select cron.schedule(
  'auth-email-sends-1-day',
  '56 2 * * *',
  $job$ delete from public.auth_email_sends where sent_at < now() - interval '1 day'; $job$
);
