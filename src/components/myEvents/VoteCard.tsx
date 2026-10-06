import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Hand, Layers } from "lucide-react";

import { ExitConfirm, ExitLink } from "@/components/myEvents/parts";
import VoteTallies from "@/components/myEvents/VoteTallies";
import { eventTitle } from "@/i18n/eventTitle";
import { useDecidingRefresh } from "@/hooks/useDecidingRefresh";
import { useLang, useT } from "@/i18n/lang";
import { formatDate, nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stillToAnswer, upcomingDates, voteStage, type VoteEvent } from "@/lib/vote";

/**
 * A vote on a phone's My events (#74). With dates for you to answer, the
 * way into swiping them (SwipeDates); once you have, where it stands: who
 * hasn't answered, or that the suggester chooses, with each date's answers
 * (VoteTallies) and a way back in to change yours.
 */
export default function VoteCard({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const stage = voteStage(event);
  // Everyone has answered: the decided date shows as soon as it exists.
  useDecidingRefresh(event);
  const dates = upcomingDates(event);
  const you = event.invitees.find((i) => i.isYou)?.profileId;
  const answered = dates.filter((d) => you && d.answers[you]).length;
  const toAnswer = stage === "answer";
  const span =
    dates.length > 1
      ? t.events.dateSpan(formatDate(dates[0].start, lang), formatDate(dates.at(-1)!.start, lang))
      : dates[0]
        ? formatDate(dates[0].start, lang)
        : "";

  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm sm:p-5",
        toAnswer ? "border-primary/30" : "border-amber-200 bg-amber-50/60",
      )}
    >
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          toAnswer ? "text-primary" : "text-amber-800",
        )}
      >
        {event.group.name} · {eventTitle(event.title, t)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-xl font-bold text-foreground">
        {toAnswer ? (
          <Layers className="h-5 w-5 shrink-0 text-primary" />
        ) : stage === "choose" ? (
          <Hand className="h-5 w-5 shrink-0 text-primary" />
        ) : (
          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        {toAnswer
          ? t.events.datesToAnswer(dates.length - answered)
          : stage === "choose"
            ? t.swipe.chooseNow
            : stage === "waitingForChoice"
              ? t.swipe.waitingForChoice(event.createdBy.name)
              : t.events.waitingFor(nameList(stillToAnswer(event), lang))}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {span}
        {" · "}
        {event.createdBy.isYou ? t.events.youSuggested : t.events.suggestedBy(event.createdBy.name)}
      </p>

      {toAnswer ? (
        <Link
          to={`/events/${event.id}/dates`}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
        >
          <Layers className="h-5 w-5" />
          {answered > 0 ? t.events.continueAnswering(answered, dates.length) : t.events.answerDates}
        </Link>
      ) : (
        <>
          <div className="mt-3">
            <VoteTallies event={event} />
          </div>
          <Link
            to={`/events/${event.id}/dates`}
            className="mt-3 inline-flex text-sm font-medium text-primary"
          >
            {t.events.changeAnswers}
          </Link>
        </>
      )}

      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} className="mt-3" />
      ) : (
        <div className="mt-3">
          <ExitLink event={event} onClick={() => setExiting(true)} />
        </div>
      )}
    </li>
  );
}
