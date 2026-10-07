-- Deleting what nobody needs any more, on a schedule (#81). The periods are
-- the ones the privacy policy states under "How long Casy keeps things":
--
--   events whose every date ended over 12 months ago (dates, invitees,
--     answers and calendar-entry rows go with them by cascade);
--   cancelled events, and events that found no date, 30 days after their
--     last change;
--   invite links 30 days after they expired;
--   email-lookup rows after a day (they only serve the daily limit);
--   calendar connections that never finished connecting (pending or error),
--     after 7 days. A connection is only marked connected once its calendars
--     are stored, and never goes back (a failing sync sets sync_error), so
--     these are attempts that died, never a working account;
--   declined group invitations 6 months after they were sent, so the same
--     group may invite that person again.
--
-- An event with calendar work left to do (calendar_event_writes where wanted
-- <> added, such as a cancelled event not yet taken out of someone's
-- calendar) is left until that is done: deleting it would lose the entry.
--
-- Never touched: busy times (every sync replaces them), groups, accounts.
--
-- This migration only creates the function. Run it by hand first:
--   select cleanup_old_data(dry_run => true);
-- which answers what it would delete, per table, and deletes nothing. The
-- nightly schedule is a migration of its own, added once that looks right.

-- Fail here, not at 3 at night, if the tables aren't what this expects.
do $$
begin
  if to_regclass('public.event_proposals') is null
    or to_regclass('public.event_proposal_dates') is null
    or to_regclass('public.calendar_event_writes') is null
    or to_regclass('public.group_invites') is null
    or to_regclass('public.group_email_lookups') is null
    or to_regclass('public.calendar_connections') is null
    or to_regclass('public.group_invitations') is null then
    raise exception 'cleanup_old_data: a table it cleans up is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'group_invites' and column_name = 'expires_at'
  ) then
    raise exception 'cleanup_old_data: group_invites.expires_at is missing';
  end if;
end;
$$;

-- What each run deleted (or, for a dry run, would have), for checking it
-- works. Counts only: never which rows.
create table if not exists cleanup_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  dry_run boolean not null,
  counts jsonb not null
);

comment on table cleanup_runs is
  'One row per cleanup_old_data() run: rows deleted per table (or that would be, for a dry run). Kept 90 days.';

alter table cleanup_runs enable row level security;

comment on table group_invitations is
  'Invitations to join a group, answered by the invited person. Declined rows block re-invites to that group until cleanup_old_data() deletes them, 6 months after they were sent.';

create or replace function cleanup_old_data(dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
begin
  -- The deletes run inside a block of their own. A dry run then throws, which
  -- undoes exactly that block: the counts are those of the real deletes,
  -- cascades and all, and nothing is gone.
  begin
    delete from event_proposals p
    where (select max(d.ends_at) from event_proposal_dates d where d.proposal_id = p.id)
        < now() - interval '12 months'
      and not exists (
        select 1 from calendar_event_writes w where w.proposal_id = p.id and w.wanted <> w.added
      );
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('past_events', v_n);

    delete from event_proposals p
    where p.status in ('cancelled', 'no_date')
      and p.updated_at < now() - interval '30 days'
      and not exists (
        select 1 from calendar_event_writes w where w.proposal_id = p.id and w.wanted <> w.added
      );
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('closed_events', v_n);

    delete from group_invites where expires_at < now() - interval '30 days';
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('invite_links', v_n);

    delete from group_email_lookups where created_at < now() - interval '1 day';
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('email_lookups', v_n);

    delete from calendar_connections
    where status in ('pending', 'error') and created_at < now() - interval '7 days';
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('connection_attempts', v_n);

    delete from group_invitations
    where status = 'declined' and created_at < now() - interval '6 months';
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('declined_invitations', v_n);

    if dry_run then
      raise exception using errcode = 'P0001', message = 'cleanup_old_data dry run';
    end if;
  exception when sqlstate 'P0001' then
    -- Only the dry run's own exception is caught; anything else fails the run.
    if sqlerrm <> 'cleanup_old_data dry run' then
      raise;
    end if;
  end;

  insert into cleanup_runs (dry_run, counts) values (dry_run, v_counts);
  delete from cleanup_runs where ran_at < now() - interval '90 days';
  return v_counts;
end;
$$;

-- Run by pg_cron and by hand in the SQL editor, never through the API.
revoke execute on function cleanup_old_data(boolean) from public, anon, authenticated;
