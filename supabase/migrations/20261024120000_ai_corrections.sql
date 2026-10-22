-- Learning from use (#122): the corrections people write ("Forkert?" under an
-- event's label, #112) and, later, what they change in a plan Casy's AI made
-- (Planlæg med AI, #100), stored for the project owner to review, so a mistake
-- the AI makes for everyone becomes a sharper rule in its prompt and a new
-- made-up case in the eval sets. Nothing trains a model.
--
-- Only from people who said yes to the AI using their calendar under a wording
-- that names this (consent version 3, #120), and who haven't switched sharing
-- off (ai_consent.share_corrections, on by default with the yes). A row holds
-- only what the kind needs, in `data`; admin mode lists the rows without ever
-- saying whose they are, and marking one handled deletes it. A person's rows are
-- listed in Your data with a delete, go when they withdraw the yes, with the
-- account (cascade), and 90 days after they were sent, nightly.
--
-- Safe to run twice.

do $$
begin
  if to_regclass('public.ai_consent') is null then
    raise exception 'ai_consent is missing: apply 20261022120000_ai_consent first';
  end if;
end;
$$;

alter table ai_consent
  add column if not exists share_corrections boolean not null default true;

comment on column ai_consent.share_corrections is
  'Whether the person''s corrections of the AI are sent to Casy for review (#122): on with the yes, switched off in Your data without withdrawing it.';

create table if not exists ai_corrections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('label', 'plan')),
  data jsonb not null check (pg_column_size(data) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists ai_corrections_profile_idx on ai_corrections (profile_id);
create index if not exists ai_corrections_created_idx on ai_corrections (created_at desc);

comment on table ai_corrections is
  'Corrections of the AI sent to Casy for review (#122): the kind, and what that kind needs (a label correction: title, calendar name, old label, note, new label; a plan: the text, the plan made, what was changed). Admin mode lists them without saying whose. Deleted when handled, on withdrawal, with the account, and 90 days after sending.';

-- Like every table: the browser reads and writes nothing; the functions do.
alter table ai_corrections enable row level security;

-- The 90 days, every night (UTC, beside the other cleanup). Scheduling under
-- a name it already has replaces that job.
select cron.schedule(
  'ai-corrections-90-days',
  '58 2 * * *',
  $job$ delete from public.ai_corrections where created_at < now() - interval '90 days'; $job$
);
