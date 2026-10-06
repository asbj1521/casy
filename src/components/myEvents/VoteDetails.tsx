import { useRef, useState } from "react";
import { LogOut, Users, X } from "lucide-react";

import { ExitConfirm } from "@/components/myEvents/parts";
import VoteTallies from "@/components/myEvents/VoteTallies";
import DateDeck from "@/components/swipe/DateDeck";
import { eventTitle } from "@/i18n/eventTitle";
import { useFillViewport } from "@/hooks/useFillViewport";
import { useLang, useT } from "@/i18n/lang";
import { nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stillToAnswer, voteStage, type VoteEvent } from "@/lib/vote";

/**
 * A vote opened beside the list on a computer's My events (#74): the same
 * cards as a phone's swipe screen while you have dates to answer, beside
 * your calendar and answered with buttons and the arrow keys, filling the
 * window so it all fits on one screen; then how the dates stand, where the
 * suggester can settle it. "Change your answers" brings the cards back.
 */
export default function VoteDetails({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const stage = voteStage(event);
  // Back to the cards to change answers, after answering them all.
  const [deck, setDeck] = useState(stage === "answer");
  const showDeck = deck || stage === "answer";
  const missing = stillToAnswer(event);
  // The cards fill the window below the header, so the date, the answers and
  // your calendar fit on one screen; the box's own padding, and a gap, below.
  const deckBox = useRef<HTMLDivElement>(null);
  const deckHeight = useFillViewport(deckBox, { bottom: 40, min: 460, active: showDeck });
  const link = "shrink-0 text-sm font-medium transition";

  return (
    <>
      {/* One line: where it stands, which event, who suggested it, and the ways out. */}
      <div className="mt-5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            stage === "answer" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800",
          )}
        >
          {stage === "answer" ? t.events.needsAnswer : t.events.waitingForOthers}
        </span>
        <p className="flex min-w-0 items-center gap-x-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <span className="truncate">{event.group.name}</span>
          <span aria-hidden>·</span>
          <span className="truncate text-foreground">{eventTitle(event.title, t)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {event.createdBy.isYou
            ? t.events.youSuggested
            : t.events.suggestedBy(event.createdBy.name)}
        </p>
        <span className="ml-auto flex items-center gap-4">
          {stage !== "answer" && (
            <button
              type="button"
              onClick={() => setDeck(!showDeck)}
              className={cn(link, "text-primary hover:opacity-80")}
            >
              {showDeck ? t.events.seeTallies : t.events.changeAnswers}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExiting(true)}
            className={cn(link, "flex items-center gap-1 text-muted-foreground hover:text-red-700")}
          >
            {event.createdBy.isYou ? <X className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
          </button>
        </span>
      </div>
      {exiting && <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />}

      {showDeck ? (
        <div ref={deckBox} className="mt-3" style={{ height: deckHeight ?? undefined }}>
          {deckHeight !== null && <DateDeck event={event} variant="pane" />}
        </div>
      ) : (
        <div className="mt-4 max-w-xl pb-2">
          <p className="text-lg font-bold text-foreground">
            {stage === "choose"
              ? t.swipe.chooseNow
              : stage === "waitingForChoice"
                ? t.swipe.waitingForChoice(event.createdBy.name)
                : missing.length > 0
                  ? t.events.waitingFor(nameList(missing, lang))
                  : t.swipe.deciding}
          </p>
          <div className="mt-3">
            <VoteTallies event={event} />
          </div>
        </div>
      )}
    </>
  );
}
