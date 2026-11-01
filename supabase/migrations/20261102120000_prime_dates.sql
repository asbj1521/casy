-- Tid til hinanden (#171): the phone stars days a whole group is free on its
-- own home page, worked out on the phone and never stored. Each member may
-- switch that off for a group; the choice is theirs alone, kept on their
-- membership and gone with it.
--
-- Safe to run twice.

alter table group_members add column if not exists prime_dates boolean not null default true;

comment on column group_members.prime_dates is
  'Whether this member''s home page stars days the whole group is free (#171, Tid til hinanden). Their own choice; on unless switched off.';
