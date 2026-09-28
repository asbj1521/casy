-- A name you gave a calendar yourself, set on My calendar.
--
-- Kept apart from display_name, which is the provider's own name for it
-- (saved when the account is connected), so clearing yours brings the
-- original back and the list can show which calendar it really is in
-- Apple, Google or Outlook. Null means "use the provider's name". Only the
-- owner ever sees it: group members never see calendar names at all.
alter table calendar_sources
  add column if not exists custom_name text
  check (custom_name is null or char_length(custom_name) between 1 and 60);
