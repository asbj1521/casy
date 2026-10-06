import { useState } from "react";
import { LogOut, Users, X } from "lucide-react";

import { ExitConfirm } from "@/components/myEvents/parts";
import VoteTallies from "@/components/myEvents/VoteTallies";
import DateDeck from "@/components/swipe/DateDeck";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { eventTitle } from "@/i18n/eventTitle";
import { useLang, useT } from "@/i18n/lang";
import { nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stillToAnswer, voteStage, type VoteEvent } from "@/lib/vote";

/**
 * A vote opened beside the list on a computer's My events (#74): the same
 * cards as a phone's swipe screen while you have dates to answer (with
 * buttons and the arrow keys, though a mouse can drag them too), then how
 * the dates stand, where the suggester can settle it. "Change my answers"
 * brings the cards back.
 */
export default function VoteDetails({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const stage = voteStage(event);
  // Back to the cards to change answers, after answering them all.
  const [deck, setDeck] = useState(stage === "answer");
  const missing = stillToAnswer(event);

  return (
    <>
      <div className="mt-6 min-w-0">
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
            stage === "answer" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800",
          )}
        >
          {stage === "answer" ? t.events.needsAnswer : t.events.waitingForOthers}
        </span>
        <p className="mt-3 flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          {event.group.name}
          <span aria-hidden>·</span>
          <span className="text-foreground">{eventTitle(event.title, t)}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {event.createdBy.isYou
            ? t.events.youSuggested
            : t.events.suggestedBy(event.createdBy.name)}
        </p>
      </div>

      {deck || stage === "answer" ? (
        <div className="mt-4">
          <DateDeck event={event} variant="pane" />
          {stage !== "answer" && (
            <button
              type="button"
              onClick={() => setDeck(false)}
              className="mt-3 text-sm font-medium text-primary"
            >
              {t.events.seeTallies}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 max-w-xl">
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
          <button
            type="button"
            onClick={() => setDeck(true)}
            className="mt-3 text-sm font-medium text-primary"
          >
            {t.events.changeAnswers}
          </button>
        </div>
      )}

      <ListGroup>
        <ListRow
          icon={event.createdBy.isYou ? X : LogOut}
          label={event.createdBy.isYou ? t.events.cancelEvent : t.events.leaveEvent}
          tone="danger"
          onClick={() => setExiting(true)}
        />
      </ListGroup>
      {exiting && <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />}
    </>
  );
}
