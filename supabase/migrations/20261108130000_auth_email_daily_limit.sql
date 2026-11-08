-- A ceiling per day on the auth emails anyone can ask for (#235). Resend's
-- free plan sends 100 emails a day and then refuses, security notices too, so
-- the limited kinds stop below that and leave room for those. The numbers are
-- in _shared/authEmailLimits.ts.
--
-- p_all_per_day may be left out, so the auth-email function deployed before
-- this one keeps working until the new one is deployed.

drop function if exists claim_auth_email(text, int, int, int);

create function claim_auth_email(
  p_recipient text,
  p_per_hour int,
  p_per_day int,
  p_all_per_hour int,
  p_all_per_day int default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_hour int;
  v_day int;
  v_all_hour int;
  v_all_day int;
begin
  if p_recipient is null or p_recipient !~ '^[0-9a-f]{64}$' then
    raise exception 'claim_auth_email: p_recipient must be a hex HMAC';
  end if;
  if p_per_hour is null or p_per_hour < 1 or p_per_day is null or p_per_day < 1
     or p_all_per_hour is null or p_all_per_hour < 1
     or (p_all_per_day is not null and p_all_per_day < 1) then
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

  select count(*) filter (where sent_at >= now() - interval '1 hour'), count(*)
    into v_all_hour, v_all_day
  from auth_email_sends;
  if v_all_hour >= p_all_per_hour or v_all_day >= p_all_per_day then
    return jsonb_build_object('exhausted', 'all');
  end if;

  insert into auth_email_sends (recipient) values (p_recipient);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function claim_auth_email(text, int, int, int, int) from public, anon, authenticated;
grant execute on function claim_auth_email(text, int, int, int, int) to service_role;
