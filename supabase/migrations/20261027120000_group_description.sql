-- Group description (#152): what a group is for, in its members' own words,
-- set when the group is made and changed by any member, like its name.
-- Optional; at most 200 characters (the groups function trims and caps it
-- too, MAX_GROUP_DESCRIPTION_LENGTH in _shared/groups.ts).

alter table friend_groups add column if not exists description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'friend_groups_description_length'
  ) then
    alter table friend_groups
      add constraint friend_groups_description_length
      check (description is null or char_length(description) between 1 and 200);
  end if;
end $$;
