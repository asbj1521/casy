-- Whether a calendar counts at all: the tick box next to it on My calendar.
-- An unticked calendar keeps syncing (so ticking it again is instant) but is
-- left out when finding dates for groups and hidden on My calendar.
--
-- Every existing calendar stays included, which is how they have all behaved
-- until now, and new ones get it from the default (the functions that add
-- calendars never set it).
alter table calendar_sources
  add column if not exists included boolean not null default true;
