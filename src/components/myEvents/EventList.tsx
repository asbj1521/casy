import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import type { EventStage, StagedEvent } from "@/lib/myEvents";
import { upcomingDates } from "@/lib/vote";
import { cn } from "@/lib/utils";

/**
 * The headings the list is grouped under. A vote to answer (#74) sits with
 * the dates to answer, and one you've answered with those waiting on others.
 */
const HEADINGS = ["needsAnswer", "waiting", "scheduled", "closed"] as const;
type Heading = (typeof HEADINGS)[number];
const HEADING_OF: Record<EventStage, Heading> = {
  toSwipe: "needsAnswer",
  needsAnswer: "needsAnswer",
  voting: "waiting",
  waiting: "waiting",
  scheduled: "scheduled",
  closed: "closed",
};

/** Each section's dot, in its card's colour on a phone. */
const DOT: Record<Heading, string> = {
  needsAnswer: "bg-primary",
  waiting: "bg-amber-500",
  scheduled: "bg-emerald-500",
  closed: "bg-muted-foreground/40",
};

/**
 * The left pane of a computer's My events: the events as a list under the
 * page's section headings, each row opening the event beside it
 * (/events/:eventId), the open one `selected`. Like GroupList on My groups.
 */
export default function EventList({
  events,
  selectedId,
}: {
  events: StagedEvent[];
  selectedId: string | undefined;
}) {
  const t = useT();
  const { lang } = useLang();
  const titles: Record<Heading, string> = {
    needsAnswer: t.events.needsAnswer,
    waiting: t.events.waitingForOthers,
    scheduled: t.events.scheduled,
    closed: t.events.pastClosed,
  };

  return (
    <div className="min-w-0">
      {HEADINGS.map((stage) => {
        const inStage = events.filter((e) => HEADING_OF[e.stage] === stage);
        if (inStage.length === 0) return null;
        return (
          <ListGroup
            key={stage}
            title={
              <>
                {titles[stage]}
                {stage === "needsAnswer" && (
                  <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {inStage.length}
                  </span>
                )}
              </>
            }
          >
            {inStage.map((staged) => {
              const { event } = staged;
              const when =
                staged.stage === "toSwipe" || staged.stage === "voting"
                  ? t.events.dateCount(upcomingDates(staged.event).length)
                  : event.currentDate
                    ? formatEventDate(event.settings.kind, event.currentDate, lang)
                    : t.events.stageNoDate;
              return (
                <ListRow
                  key={event.id}
                  to={`/events/${event.id}`}
                  selected={event.id === selectedId}
                  leading={<span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[stage])} />}
                  label={eventTitle(event.title, t)}
                  detail={`${event.group.name} · ${when}`}
                />
              );
            })}
          </ListGroup>
        );
      })}
    </div>
  );
}
