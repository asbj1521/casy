-- Retire the one-date-at-a-time flow from before votes (#74, #159).
--
-- Events suggested before votes offered one date, accepted or declined by
-- each person, a decline swapping in the next date (respond_to_event). The
-- `suggest` action has refused that for weeks, so no new ones exist; scheduled
-- and past ones stay and are still read and shown. A single-date event still
-- waiting for answers is called off here (nothing of it is in any calendar
-- yet, so there is nothing to take out), and the function only that flow used
-- goes. refresh_event_status keeps its single-date branch: leaving an event or
-- a group still runs through it, and with nothing pending it simply never fires.

do $$
declare
  v_closed integer;
begin
  update event_proposals
     set status = 'cancelled', updated_at = now()
   where mode = 'single'
     and status = 'pending';
  get diagnostics v_closed = row_count;
  raise notice 'retire_single_date_events: % pending single-date events called off', v_closed;
end $$;

drop function if exists respond_to_event(uuid, uuid, uuid, text, timestamptz, timestamptz);
