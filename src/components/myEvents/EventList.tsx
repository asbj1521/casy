import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import { STAGES, type EventStage, type StagedEvent } from "@/lib/myEvents";
import { cn } from "@/lib/utils";

/** Each section's dot, in its card's colour on a phone. */
const DOT = {
  needsAnswer: "bg-primary",
  waiting: "bg-amber-500",
  scheduled: "bg-emerald-500",
  closed: "bg-muted-foreground/40",
} as const;

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
  const titles: Record<EventStage, string> = {
    needsAnswer: t.events.needsAnswer,
    waiting: t.events.waitingForOthers,
    scheduled: t.events.scheduled,
    closed: t.events.pastClosed,
  };

  return (
    <div className="min-w-0">
      {STAGES.map((stage) => {
        const inStage = events.filter((e) => e.stage === stage);
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
            {inStage.map(({ event }) => (
              <ListRow
                key={event.id}
                to={`/events/${event.id}`}
                selected={event.id === selectedId}
                leading={<span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[stage])} />}
                label={eventTitle(event.title, t)}
                detail={`${event.group.name} · ${
                  event.currentDate
                    ? formatEventDate(event.settings.kind, event.currentDate, lang)
                    : t.events.stageNoDate
                }`}
              />
            ))}
          </ListGroup>
        );
      })}
    </div>
  );
}
