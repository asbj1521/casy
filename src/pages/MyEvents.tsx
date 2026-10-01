import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, Loader2, Sparkles } from "lucide-react";

import { eventsQuery, type SuggestedEvent } from "@/api/events";
import InvitationsSection from "@/components/myEvents/InvitationsSection";
import NeedsAnswerCard from "@/components/myEvents/NeedsAnswerCard";
import ScheduledCard from "@/components/myEvents/ScheduledCard";
import WaitingCard from "@/components/myEvents/WaitingCard";
import TopNav from "@/components/TopNav";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import { sectionEvents } from "@/lib/myEvents";
import { cn } from "@/lib/utils";

/**
 * My events: every date suggested to your groups, sorted by what it needs
 * from you (lib/myEvents.ts). Invitations to groups come first, then dates
 * to answer; then the dates waiting on others, the ones everyone accepted,
 * and the past.
 */
export default function MyEvents() {
  const userId = useSignedInUser().id;
  const t = useT();
  const { data: events, isPending, isError } = useQuery(eventsQuery(userId));

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.events.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.events.intro}</p>

        <InvitationsSection />

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
          <EventSections events={events} />
        )}
      </main>
    </div>
  );
}

function EventSections({ events }: { events: SuggestedEvent[] }) {
  const t = useT();
  const { lang } = useLang();
  const sections = sectionEvents(events);

  // Cancelled events are in no section, so this means nothing left to show,
  // not an empty list from the server.
  if (Object.values(sections).every((list) => list.length === 0)) {
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

  return (
    <>
      <Section title={t.events.needsAnswer} count={sections.needsAnswer.length}>
        {sections.needsAnswer.map((event) => (
          <NeedsAnswerCard key={event.id} event={event} />
        ))}
      </Section>

      <Section title={t.events.waitingForOthers}>
        {sections.waiting.map((event) => (
          <WaitingCard key={event.id} event={event} />
        ))}
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
