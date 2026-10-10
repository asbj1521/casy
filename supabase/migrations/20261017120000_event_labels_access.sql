-- Event labels (#112) for people who aren't admins. Labelling sends a
-- person's event titles to Anthropic, which the privacy policy doesn't cover
-- for everyone until #120, so having the AI features on isn't enough: an
-- admin switches labels on separately, per person, in admin mode, for
-- someone who knows what it sends. Admins always may (checked in code).
-- Switching AI off deletes the row, and labels with it.

do $$
begin
  if to_regclass('public.ai_access') is null then
    raise exception 'ai_access is missing: apply 20261016120000_ai_budgets first';
  end if;
end;
$$;

alter table ai_access
  add column if not exists event_labels boolean not null default false;

comment on column ai_access.event_labels is
  'Event labels (#112): this person''s phone may send event titles to be labelled. Off unless an admin switched it on.';
