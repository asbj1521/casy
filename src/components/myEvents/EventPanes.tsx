import { Navigate } from "react-router-dom";

import { type SuggestedEvent } from "@/api/events";
import EventDetails from "@/components/myEvents/EventDetails";
import EventList from "@/components/myEvents/EventList";
import { eventsInOrder, sectionEvents } from "@/lib/myEvents";
import NoEvents from "@/components/myEvents/NoEvents";

/**
 * A computer's My events: the list on the left, the open event on the right,
 * in the same columns as My groups. An event asked for that's gone (cancelled,
 * left, or never yours) sends the page back to the first.
 */
export default function EventPanes({
  events,
  selectedId,
}: {
  events: SuggestedEvent[];
  selectedId: string | undefined;
}) {
  const ordered = eventsInOrder(sectionEvents(events));
  if (ordered.length === 0) return <NoEvents />;
  const open = selectedId ? ordered.find((e) => e.event.id === selectedId) : ordered[0];
  if (!open) return <Navigate to="/events" replace />;

  return (
    <div className="grid items-start gap-x-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <EventList events={ordered} selectedId={open.event.id} />
      {/* Relative and clipped: a vote's calendar opens to fill exactly this box. */}
      <section className="relative mt-6 min-w-0 overflow-hidden rounded-2xl border bg-card/60 p-5 pt-0 sm:p-6 sm:pt-0">
        {/* Keyed, so a half-asked "decline?" never carries over to the next event. */}
        <EventDetails key={open.event.id} staged={open} />
      </section>
    </div>
  );
}
