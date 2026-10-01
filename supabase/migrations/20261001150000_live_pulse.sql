-- Keeping open pages up to date: live_pulse() boils everything one person can
-- see change (their groups, members and names, invitations, open events with
-- their dates, invitees and answers, and their own calendar writes) down to
-- one short fingerprint. The browser asks for it every few seconds and only
-- fetches the real data when it changed.
--
-- It hashes the rows themselves rather than reading a "last changed" stamp:
-- no write anywhere has to remember to bump anything (answering a date
-- without completing it, or leaving an event, changes no timestamp), and it
-- only reads, so it takes no locks. Every lookup is by an indexed column, and
-- only open events are included: a past or cancelled one dropping out of the
-- list changes the fingerprint too.
create or replace function live_pulse(p_profile_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  with my_groups as (
    select group_id from group_members where profile_id = p_profile_id
  ),
  open_events as (
    select p.id, p.status, p.updated_at
    from event_proposals p
    where p.group_id in (select group_id from my_groups)
      and p.status in ('pending', 'scheduled')
  )
  select md5(concat_ws('|',
    coalesce((
      select string_agg(row(g.id, g.name)::text, ',' order by g.id)
      from friend_groups g
      where g.id in (select group_id from my_groups)
    ), ''),
    coalesce((
      select string_agg(row(m.group_id, m.profile_id, pr.display_name)::text, ','
                        order by m.group_id, m.profile_id)
      from group_members m
      left join profiles pr on pr.id = m.profile_id
      where m.group_id in (select group_id from my_groups)
    ), ''),
    coalesce((
      select string_agg(row(i.group_id, i.profile_id, i.status)::text, ','
                        order by i.group_id, i.profile_id)
      from group_invitations i
      where i.group_id in (select group_id from my_groups) or i.profile_id = p_profile_id
    ), ''),
    coalesce((
      select string_agg(row(e.id, e.status, e.updated_at)::text, ',' order by e.id)
      from open_events e
    ), ''),
    coalesce((
      select string_agg(row(d.id, d.declined_at)::text, ',' order by d.id)
      from event_proposal_dates d
      where d.proposal_id in (select id from open_events)
    ), ''),
    coalesce((
      select string_agg(row(v.proposal_id, v.profile_id)::text, ','
                        order by v.proposal_id, v.profile_id)
      from event_invitees v
      where v.proposal_id in (select id from open_events)
    ), ''),
    coalesce((
      select string_agg(row(r.date_id, r.profile_id, r.response)::text, ','
                        order by r.date_id, r.profile_id)
      from event_responses r
      join event_proposal_dates d on d.id = r.date_id
      where d.proposal_id in (select id from open_events)
    ), ''),
    coalesce((
      select string_agg(row(w.proposal_id, w.added, w.gone_at)::text, ',' order by w.proposal_id)
      from calendar_event_writes w
      where w.profile_id = p_profile_id
    ), '')
  ));
$$;

-- Service role only, like every other function here.
revoke execute on function live_pulse(uuid) from public, anon, authenticated;
grant execute on function live_pulse(uuid) to service_role;
