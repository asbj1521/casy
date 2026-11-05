import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { cancelEvent, leaveEvent } from "@/api/events";

import DateTile from "@/components/myEvents/phone/DateTile";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import SwipeReveal from "@/components/ui/SwipeReveal";
import { useDecidingRefresh } from "@/hooks/useDecidingRefresh";
import { useEventChange } from "@/hooks/useEventChange";
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
 *
 * A row to come slides left (#223): your own event to cancel, asked first
 * since it goes for everyone, anyone else's to leave at the press. Their
 * screens keep both, for anyone who can't swipe. What is over has neither.
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
  // One row swiped open at a time.
  const [swiped, setSwiped] = useState<string | null>(null);
  const swipe = { swiped, setSwiped };
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
              swipe={swipe}
            />
          ))}
        </ListGroup>
      )}
      {coming.length > 0 && (
        <ListGroup title={t.events.groupComing} className={answer.length > 0 ? undefined : "mt-4"}>
          {coming.map((s) => (
            <EventRow
              key={s.event.id}
              staged={s}
              onClick={() => onOpen(s.event.id)}
              swipe={swipe}
            />
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
  swipe,
}: {
  staged: StagedEvent;
  onClick?: () => void;
  /** What a press does, in orange at the end: "Svar", "Vælg". */
  cue?: string;
  /** Which row is swiped open; none for what is over. */
  swipe?: {
    swiped: string | null;
    setSwiped: (change: (now: string | null) => string | null) => void;
  };
}) {
  const t = useT();
  const { stage, event } = staged;
  const mine = event.createdBy.isYou;
  const [asking, setAsking] = useState(false);
  const cancel = useEventChange(() => cancelEvent(event.id));
  const leave = useEventChange(() => leaveEvent(event.id));
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
        wrap={
          swipe
            ? (row) => (
                <>
                  <SwipeReveal
                    label={mine ? t.events.swipeCancel : t.events.swipeLeave}
                    open={swipe.swiped === event.id}
                    onOpenChange={(open) =>
                      swipe.setSwiped((now) => (open ? event.id : now === event.id ? null : now))
                    }
                    onPress={() => {
                      if (mine) setAsking(true);
                      else leave.mutate();
                    }}
                  >
                    {row}
                  </SwipeReveal>
                  {asking && (
                    <ConfirmPanel
                      className="mx-4 mb-3"
                      message={t.events.cancelConfirm}
                      confirmLabel={t.events.cancelEvent}
                      busy={cancel.isPending}
                      error={cancel.error?.message}
                      onConfirm={() => cancel.mutate()}
                      onCancel={() => {
                        setAsking(false);
                        swipe.setSwiped(() => null);
                      }}
                    />
                  )}
                  {leave.isError && (
                    <Notice tone="error" bare className="mx-4 mb-3">
                      {leave.error.message}
                    </Notice>
                  )}
                </>
              )
            : undefined
        }
        trailing={
          onClick &&
          (cue ? (
            <span className="flex shrink-0 items-center text-[0.9375rem] font-semibold text-primary">
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
