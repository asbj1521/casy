-- The profile of a suggested event (#113): what it is likely to cause for
-- the people going (a late night, alcohol, travel, hard exercise), how
-- tiring it is, and whether it is outdoors and needs daylight, as Claude
-- Haiku read it from the event's name, place, note and planned timing
-- (_shared/profileAi.ts). The scheduler fetches it while the event is set
-- up and sends it with the dates; it is kept with the event so everyone's
-- own warnings (#114) can use it without asking again.
--
-- Null when none came with it: AI off for the suggester, the call failed
-- or was slow, or the event is older. Deleted with the event, like its
-- title. Read back through cleanProfile, so its shape can change.

do $$
begin
  if to_regclass('public.event_proposals') is null then
    raise exception 'event_proposals is missing';
  end if;
end;
$$;

alter table event_proposals add column if not exists impact jsonb;

alter table event_proposals drop constraint if exists event_proposals_impact_object;
alter table event_proposals
  add constraint event_proposals_impact_object
  check (impact is null or jsonb_typeof(impact) = 'object');

comment on column event_proposals.impact is
  'What the event is likely to cause for the people going (#113), from the AI; null if none came with it.';
