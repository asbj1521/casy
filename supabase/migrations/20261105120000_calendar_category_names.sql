-- A calendar's own name for its category (#220). The kind stays in `purpose`,
-- which is what scheduling reads, so the engine doesn't change; this is only
-- what its owner calls it. Never sent to a group or to the AI.
alter table calendar_sources
  add column if not exists category_name text
  check (category_name is null or char_length(category_name) between 1 and 30);

comment on column calendar_sources.category_name is
  'Its owner''s own name for the category; purpose holds the kind that scheduling reads. Null for one of the four built-in categories.';
