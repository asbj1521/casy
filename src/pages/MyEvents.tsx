import { useEffect, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, Loader2, Sparkles } from "lucide-react";

import { eventsQuery, type SuggestedEvent } from "@/api/events";
import EventDetails from "@/components/myEvents/EventDetails";
import EventList from "@/components/myEvents/EventList";
import NeedsAnswerCard from "@/components/myEvents/NeedsAnswerCard";
import ScheduledCard from "@/components/myEvents/ScheduledCard";
import VoteCard from "@/components/myEvents/VoteCard";
import WaitingCard from "@/components/myEvents/WaitingCard";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useGroupRefresh } from "@/hooks/useGroupRefresh";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import { eventsInOrder, sectionEvents } from "@/lib/myEvents";
import { cn } from "@/lib/utils";

/**
 * My events: every date suggested to your groups, sorted by what it needs
 * from you (lib/myEvents.ts): dates to answer first, then the dates waiting
 * on others, the ones everyone accepted, and the past. A phone shows them as
 * cards, section by section; a computer as a list beside the open event
 * (/events/:eventId, else the first), like My groups.
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
        <p className="mt-1 text-sm text-muted-foreground">{t.events.intro}</p>
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
          <EventSections events={events} />
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

/** A phone's My events: each section's events as cards. */
function EventSections({ events }: { events: SuggestedEvent[] }) {
  const t = useT();
  const { lang } = useLang();
  const sections = sectionEvents(events);

  if (Object.values(sections).every((list) => list.length === 0)) return <NoEvents />;

  return (
    <>
      {/* Votes to swipe (#74) first: answering them is the most to do. */}
      <Section
        title={t.events.needsAnswer}
        count={sections.toSwipe.length + sections.needsAnswer.length}
      >
        {[
          ...sections.toSwipe.map((event) => <VoteCard key={event.id} event={event} />),
          ...sections.needsAnswer.map((event) => <NeedsAnswerCard key={event.id} event={event} />),
        ]}
      </Section>

      <Section title={t.events.waitingForOthers}>
        {[
          ...sections.voting.map((event) => <VoteCard key={event.id} event={event} />),
          ...sections.waiting.map((event) => <WaitingCard key={event.id} event={event} />),
        ]}
      </Section>

      {/* Two halves need the width: at most two cards side by side. */}
      <Section title={t.events.scheduled} listClassName="xl:grid-cols-2">
        {sections.scheduled.map((event) => (
          <ScheduledCard key={event.id} event={event} />
        ))}
      </Section>

      <Section title={t.events.pastClosed} listClassName="gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {sections.closed.map((event) => (
          <li key={event.id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <CalendarX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                {event.group.name} · {eventTitle(event.title, t)}
              </p>
              <p className="text-muted-foreground">
                {event.status === "no_date" || !event.currentDate
                  ? t.events.noDate
                  : (event.status === "scheduled" ? t.events.happened : t.events.passed)(
                      formatEventDate(event.settings.kind, event.currentDate, lang),
                    )}
              </p>
            </div>
          </li>
        ))}
      </Section>
    </>
  );
}

/** One heading and its cards; nothing at all when it has none. */
function Section({
  title,
  count,
  listClassName = "md:grid-cols-2 2xl:grid-cols-3",
  children,
}: {
  title: string;
  /** A badge beside the title, for what needs doing. */
  count?: number;
  listClassName?: string;
  children: ReactNode[];
}) {
  if (children.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">
        {title}
        {count !== undefined && (
          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {count}
          </span>
        )}
      </h2>
      <ul className={cn("mt-3 grid gap-3", listClassName)}>{children}</ul>
    </section>
  );
}
