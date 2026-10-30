-- Pictures (#186, #187, #188): a profile picture, a group's picture and a
-- genvej's picture. The files are in a private storage bucket that, like
-- every table, the browser can neither read nor write: the pictures function
-- stores them, and the lists that show people and groups hand out signed
-- links to them that work for a week. Each upload gets a new path, so a
-- changed picture is a new link and nothing old is served from a cache.
--
-- Pictures are made on the phone: cut to a square, shrunk to 512 px and saved
-- again as JPEG, which also drops what a camera writes into a photo (where it
-- was taken). The bucket takes nothing else and nothing larger.
--
-- A picture is kept until it is replaced or removed, and goes with its
-- account, group or genvej: the functions delete the file, since a file in
-- storage is not deleted by the database's cascades.
--
-- Safe to run twice.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pictures', 'pictures', false, 307200, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 307200, allowed_mime_types = array['image/jpeg'];

-- The path of each picture in the bucket; null for none.
alter table profiles add column if not exists avatar_path text;
alter table friend_groups add column if not exists picture_path text;
-- Who set a group's picture last, and when (any member may: #188).
alter table friend_groups add column if not exists picture_by uuid references auth.users (id) on delete set null;
alter table friend_groups add column if not exists picture_at timestamptz;
alter table plan_presets add column if not exists picture_path text;

comment on column profiles.avatar_path is
  'The profile picture''s path in the private pictures bucket (#187); shown to the person''s groups through signed links. Null for none.';
comment on column friend_groups.picture_path is
  'The group''s picture in the private pictures bucket (#188), set by any member; null for none.';
comment on column plan_presets.picture_path is
  'A genvej''s picture in the private pictures bucket (#186), seen only by its owner; null for none.';
