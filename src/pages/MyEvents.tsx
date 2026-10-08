import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Sparkles } from "lucide-react";

import { eventsQuery, type SuggestedEvent } from "@/api/events";
import EventDetails from "@/components/myEvents/EventDetails";
import EventList from "@/components/myEvents/EventList";
import EventRows from "@/components/myEvents/phone/EventRows";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useGroupRefresh } from "@/hooks/useGroupRefresh";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { eventsInOrder, phoneEventList, sectionEvents } from "@/lib/myEvents";

/**
 * My events: every date suggested to your groups, sorted by what it needs
 * from you (lib/myEvents.ts): dates to answer first, then the dates waiting
 * on others, the ones everyone accepted, and the past. A phone shows them as
 * one list of rows, newest first, each opening in place (#103); a computer
 * as a list beside the open event (/events/:eventId, else the first), like
 * My groups.
 */
export default function MyEvents() {
  const userId = useSignedInUser().id;
  const t = useT();
  const { eventId } = useParams();
  const phone = usePhoneLayout();
  const { data: events, isPending, isError } = useQuery(eventsQuery(userId));

  // The groups of dates still waiting for answers get their calendars synced
  // in the background on opening the page, and on coming back to it, so a
  // date someone's calendar now rules out is flagged within seconds
  // (DateConflicts, #85). At most once a minute per group (useGroupRefresh).
  const refresh = useGroupRefresh(userId);
  const pendingGroups = [
    ...new Set(events?.filter((e) => e.status === "pending").map((e) => e.group.id)),
  ].join(",");
  useEffect(() => {
    if (!pendingGroups) return;
    const freshen = () => {
      if (document.visibilityState !== "visible") return;
      for (const groupId of pendingGroups.split(",")) refresh.start(groupId);
    };
    freshen();
    document.addEventListener("visibilitychange", freshen);
    return () => document.removeEventListener("visibilitychange", freshen);
  }, [pendingGroups, refresh]);

  // A phone has no screen for one event: its cards hold everything.
  if (phone && eventId) return <Navigate to="/events" replace />;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.events.title}</h1>
        {/* A computer's list explains itself; a phone's rows say it all (#103). */}
        {!phone && <p className="mt-1 text-sm text-muted-foreground">{t.events.intro}</p>}
        <DanishTimeNote className="mt-1" />

        {isPending ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.events.loading}
          </p>
        ) : isError ? (
          <Notice tone="error" bare className="mt-8">
            {t.events.loadFailed}
          </Notice>
        ) : phone ? (
          <EventRowsPage events={events} />
        ) : (
          <EventPanes events={events} selectedId={eventId} />
        )}
      </main>
    </div>
  );
}

/** Nothing to show: cancelled events are in no section, so this can follow a non-empty answer. */
function NoEvents() {
  const t = useT();
  return (
    <div className="mt-6 flex flex-col items-start rounded-2xl border bg-card p-5 sm:mt-8 sm:p-6">
      <CalendarCheck className="h-8 w-8 text-primary" />
      <p className="mt-3 font-semibold text-foreground">{t.events.emptyTitle}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t.events.emptyBody}</p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" />
        {t.events.findDate}
      </Link>
    </div>
  );
}

/**
 * A computer's My events: the list on the left, the open event on the right,
 * in the same columns as My groups. An event asked for that's gone (cancelled,
 * left, or never yours) sends the page back to the first.
 */
function EventPanes({
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

/**
 * A phone's My events (#103): one list of compact rows, newest first, past
 * events greyed out at the bottom until they drop off (phoneEventList).
 */
function EventRowsPage({ events }: { events: SuggestedEvent[] }) {
  const t = useT();
  const { live, past } = phoneEventList(events);
  if (live.length === 0 && past.length === 0) return <NoEvents />;
  return <EventRows live={live} past={past} pastTitle={t.events.pastClosed} />;
}
