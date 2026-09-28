-- When Casy noticed that an entry it added is no longer in its owner's
-- calendar: they deleted it by hand. The sync sets it while closing the row
-- (wanted and added both false), so My events can say "It's no longer in your
-- calendar" with a button to add it again, and "Add automatically" leaves it
-- alone. Adding it again clears it. Null for every other row.
alter table calendar_event_writes
  add column if not exists gone_at timestamptz;
