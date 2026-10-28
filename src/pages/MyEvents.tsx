import { lazy, Suspense } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { eventsQuery } from "@/api/events";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { loadPage } from "@/pages/lazyPages";

const EventPanes = lazy(loadPage.eventPanes);

/**
 * My events: every date suggested to your groups, sorted by what it needs
 * from you (lib/myEvents.ts): votes to answer first, then the votes waiting
 * on others, the dates everyone agreed, and the past, as a list beside the
 * open event (/events/:eventId, else the first), like My groups. A phone has
 * them in a sheet over its home page instead (#169, EventsSheet), which the
 * address leads to.
 */
export default function MyEvents() {
  const userId = useSignedInUser().id;
  const t = useT();
  useDocumentTitle(t.nav.events);
  const { eventId } = useParams();
  const phone = usePhoneLayout();
  const { data: events, isPending, isError } = useQuery(eventsQuery(userId));

  if (phone) return <Navigate to="/?events" replace />;

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
        ) : (
          <Suspense fallback={null}>
            <EventPanes events={events} selectedId={eventId} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
