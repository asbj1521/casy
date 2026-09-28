-- Calendar priorities: how much each calendar's busy time matters to its
-- owner, alongside its category (purpose).
--
--   skip    happy to skip it for anything (a lecture, training): it never
--           blocks a search, and a date that needs it skipped says so
--   normal  the rules so far: blocks a meeting; for a trip, work/school
--           needs time off and short plans don't count
--   never   never skipped: blocks meetings and trips alike (an exam)
--
-- Per calendar, like purpose, because no event titles are ever stored: one
-- lecture can't be told from another. Every existing calendar becomes
-- 'normal', which is exactly how it has behaved until now, and new ones get
-- it from the default (the functions that add calendars never set it).
alter table calendar_sources
  add column if not exists priority text not null default 'normal'
  check (priority in ('skip', 'normal', 'never'));
