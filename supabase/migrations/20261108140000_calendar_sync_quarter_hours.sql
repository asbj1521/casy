-- The calendar sync in smaller runs, every 15 minutes (#235). One long run
-- could outlast an Edge Function's limits, and an account was only marked as
-- tried once it finished, so one that killed the run stayed first in line.
-- Accounts are now claimed as they are picked; each is still synced about
-- hourly (_shared/scheduledSync.ts holds the numbers).

-- Take up to `p_limit` connected accounts not tried since `p_stale_before`,
-- least recently tried first, and mark them as tried in the same statement,
-- so two runs can never take the same account.
create or replace function claim_sync_batch(
  p_limit int,
  p_stale_before timestamptz
) returns table (connection_id uuid, connection_provider text)
language plpgsql
set search_path = public
as $$
begin
  if p_limit is null or p_limit < 1 or p_stale_before is null then
    raise exception 'claim_sync_batch: a limit of 1 or more and a time are needed';
  end if;

  return query
  update calendar_connections c
     set last_sync_attempt_at = now()
   where c.id in (
     select d.id
       from calendar_connections d
      where d.status = 'connected'
        and d.provider <> 'device'
        and (d.last_sync_attempt_at is null or d.last_sync_attempt_at < p_stale_before)
      order by d.last_sync_attempt_at asc nulls first
      limit p_limit
        for update skip locked
   )
  returning c.id, c.provider::text;
end;
$$;

revoke execute on function claim_sync_batch(int, timestamptz) from public, anon, authenticated;
grant execute on function claim_sync_batch(int, timestamptz) to service_role;

-- Raises if the old job is missing, rather than leaving two schedules.
select cron.unschedule('calendar-sync-hourly');

select cron.schedule(
  'calendar-sync',
  '2,17,32,47 * * * *', -- every 15 minutes, off the busy top of the hour
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_sync_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_sync_secret')
    ),
    body := '{"scope": "all"}'::jsonb
  );
  $job$
);
