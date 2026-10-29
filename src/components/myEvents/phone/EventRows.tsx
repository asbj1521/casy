import { ChevronRight } from "lucide-react";

import DateTile from "@/components/myEvents/phone/DateTile";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useDecidingRefresh } from "@/hooks/useDecidingRefresh";
import { eventTitle } from "@/i18n/eventTitle";
import { useT } from "@/i18n/lang";
import type { StagedEvent } from "@/lib/myEvents";
import { upcomingDates, type VoteEvent } from "@/lib/vote";

/**
 * A phone's Aftaler (#103, #177) as grouped rows: what needs you now, what
 * is to come, and what is over (phoneEventGroups). A row is its date as a
 * tile (DateTile: a vote's a stack of its dates), its name and its group;
 * where it stands is the tile and the group, not a sentence. A vote to
 * answer goes straight to answering it (`onAnswer`); the others open their
 * screen in the sheet (`onOpen`); what is over is only shown.
 */
export default function EventRows({
  answer,
  coming,
  past,
  onAnswer,
  onOpen,
}: {
  answer: StagedEvent[];
  coming: StagedEvent[];
  past: StagedEvent[];
  onAnswer: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  return (
    <>
      {answer.length > 0 && (
        <ListGroup title={t.events.groupAnswer} className="mt-4">
          {answer.map((s) => (
            <EventRow
              key={s.event.id}
              staged={s}
              onClick={() => (s.stage === "toSwipe" ? onAnswer(s.event.id) : onOpen(s.event.id))}
              cue={s.stage === "toSwipe" ? t.events.answerNow : t.events.choose}
            />
          ))}
        </ListGroup>
      )}
      {coming.length > 0 && (
        <ListGroup title={t.events.groupComing} className={answer.length > 0 ? undefined : "mt-4"}>
          {coming.map((s) => (
            <EventRow key={s.event.id} staged={s} onClick={() => onOpen(s.event.id)} />
          ))}
        </ListGroup>
      )}
      {past.length > 0 && (
        <ListGroup title={t.events.groupPast}>
          {past.map((s) => (
            <EventRow key={s.event.id} staged={s} />
          ))}
        </ListGroup>
      )}
    </>
  );
}

function EventRow({
  staged,
  onClick,
  cue,
}: {
  staged: StagedEvent;
  onClick?: () => void;
  /** What a press does, in orange at the end: "Svar", "Vælg". */
  cue?: string;
}) {
  const t = useT();
  const { stage, event } = staged;
  const past = stage === "closed";
  const voting = stage === "voting" || stage === "toSwipe";
  const dates = voting ? upcomingDates(event) : [];
  const start = voting
    ? dates[0]
      ? Date.parse(dates[0].start)
      : null
    : event.currentDate
      ? Date.parse(event.currentDate.start)
      : null;
  return (
    <>
      {voting && <DecidingRefresh event={event} />}
      <ListRow
        leading={<DateTile start={start} more={Math.max(0, dates.length - 1)} past={past} />}
        label={
          <span className={past ? "text-muted-foreground" : undefined}>
            {eventTitle(event.title, t)}
          </span>
        }
        detail={event.group.name}
        onClick={onClick}
        chevron={false}
        trailing={
          onClick &&
          (cue ? (
            <span className="flex shrink-0 items-center text-[15px] font-semibold text-primary">
              {cue}
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          ))
        }
      />
    </>
  );
}

/** A vote everyone has answered shows its decided date as soon as it exists. */
function DecidingRefresh({ event }: { event: VoteEvent }) {
  useDecidingRefresh(event);
  return null;
}
