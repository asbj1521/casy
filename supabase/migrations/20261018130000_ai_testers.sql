-- AI testers: the per-person switch for event labels (#112) becomes the
-- switch for every AI feature that is admin-only while it is tested.
-- Admins always have them; anyone else once an admin marks them as a tester
-- in admin mode (the operator's own test account, for one). Renamed rather
-- than added, so whoever had labels on is a tester from now on.
--
-- Safe to run twice: it renames only while the old name is there.

do $$
begin
  if to_regclass('public.ai_access') is null then
    raise exception 'ai_access is missing: apply 20261016120000_ai_budgets first';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_access' and column_name = 'event_labels'
  ) then
    alter table ai_access rename column event_labels to tester;
  end if;
end;
$$;

alter table ai_access add column if not exists tester boolean not null default false;

comment on column ai_access.tester is
  'An AI tester: gets every admin-only AI feature while it is tested (event labels, #112, which send event titles to AI, among them). Off unless an admin switched it on.';
