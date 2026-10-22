-- Consent for Casy's AI to use content from a person's calendar (#120): the
-- names of their calendars and the titles of their events, which go to
-- Anthropic when calendars are sorted and events labelled. Off for everyone
-- until they say yes; a row is the yes.
--
-- `version` is the wording the person agreed to. When the AI is allowed to do
-- more with calendar content (day scores shared for ranking, #119), the
-- version the server asks for goes up and everyone is asked again; a row
-- under an older version counts as no yes. Withdrawing deletes the row, and it
-- goes with the account (cascade). No text is kept here, only that and when.
--
-- Safe to run twice.

do $$
begin
  if to_regclass('public.ai_access') is null then
    raise exception 'ai_access is missing: apply 20261016120000_ai_budgets first';
  end if;
end;
$$;

create table if not exists ai_consent (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  version int not null check (version >= 1),
  given_at timestamptz not null default now()
);

comment on table ai_consent is
  'People who said yes to Casy''s AI using content from their calendar (calendar names, event titles), and under which wording (version). Deleted when they withdraw or delete the account.';

-- Like every table: the browser reads and writes nothing; the functions do.
alter table ai_consent enable row level security;
