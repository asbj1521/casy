-- Runs cleanup_old_data() for real every night (#81), now that a dry run on
-- the live data answered as expected. pg_cron keeps UTC: 02:45 is 03:45 or
-- 04:45 in Denmark, a quiet hour, and clear of the hourly sync at :17.
-- Each run's counts land in cleanup_runs; pg_cron's own log is
-- cron.job_run_details.

do $$
begin
  if to_regprocedure('public.cleanup_old_data(boolean)') is null then
    raise exception 'cleanup_old_data(boolean) is missing: apply 20261008120000_cleanup_old_data first';
  end if;
end;
$$;

-- Scheduling under a name it already has replaces that job, so this can run twice.
select cron.schedule(
  'cleanup-old-data-nightly',
  '45 2 * * *',
  $job$ select public.cleanup_old_data(dry_run => false); $job$
);
