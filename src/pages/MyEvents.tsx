import { lazy, Suspense, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { eventsQuery } from "@/api/events";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useGroupRefresh } from "@/hooks/useGroupRefresh";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Each device fetches only its own layout of the page (#157).
const EventPanes = lazy(() => import("@/components/myEvents/EventPanes"));
const EventRowsPage = lazy(() => import("@/components/myEvents/phone/EventRowsPage"));

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
  useDocumentTitle(t.nav.events);
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
          <Suspense fallback={null}>
            <EventRowsPage events={events} />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <EventPanes events={events} selectedId={eventId} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
