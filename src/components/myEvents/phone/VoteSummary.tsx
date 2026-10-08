import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { chooseDate } from "@/api/events";
import { ExitConfirm, ExitLink } from "@/components/myEvents/parts";
import PlaceNote from "@/components/myEvents/PlaceNote";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate, formatLongDate, formatTime, nameList } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  bestPick,
  leader,
  stillToAnswer,
  tally,
  upcomingDates,
  voteStage,
  type VoteEvent,
} from "@/lib/vote";

/**
 * An opened vote on a phone's My events (#103), once you have answered:
 * where it stands and by when, its place and note, and each date with how
 * many can. The date ahead is only marked once half the group has answered;
 * before that every date is as good as the next. Nobody chooses for the
 * group while it votes: only when no date can win (every one has a "can't")
 * does the suggester get a Choose button on each date.
 */
export default function VoteSummary({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const [exiting, setExiting] = useState(false);
  const choose = useEventChange((dateId: string) => chooseDate(event.id, dateId));
  const stage = voteStage(event);
  const dates = upcomingDates(event);
  const missing = stillToAnswer(event);
  const total = event.invitees.length;
  const halfIn = (total - missing.length) * 2 >= total;
  const mustChoose = stage === "choose";
  const canChoose = mustChoose && event.createdBy.isYou;
  const marked = mustChoose ? bestPick(event) : halfIn ? leader(event) : null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="font-medium text-foreground">
          {mustChoose
            ? event.createdBy.isYou
              ? t.swipe.chooseNow
              : t.swipe.waitingForChoice(event.createdBy.name)
            : missing.length > 0
              ? t.swipe.waitingFor(nameList(missing, lang))
              : t.swipe.deciding}
        </p>
        {!mustChoose && event.answerBy && missing.length > 0 && (
          <p className="text-muted-foreground">
            {t.swipe.decidedBy(formatLongDate(event.answerBy, lang), formatTime(event.answerBy))}
          </p>
        )}
      </div>

      <PlaceNote event={event} />

      <ul className="overflow-hidden rounded-xl border bg-card">
        {dates.map((d) => {
          const n = tally(d, event);
          const can = n.accepted + n.maybe;
          const isMarked = d.id === marked?.id;
          return (
            <li
              key={d.id}
              className={cn(
                "flex items-center gap-3 border-t px-3 py-2.5 first:border-t-0",
                isMarked && "bg-primary/5",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">
                  {formatEventDate(event.settings.kind, d, lang)}
                </span>
                {isMarked && (
                  <span className="block text-xs font-semibold text-primary">
                    {mustChoose ? t.events.bestPick : t.events.ahead}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {t.events.canOnDate(can)}
                {n.declined > 0 && (
                  <span className="block text-rose-700">{t.events.cantOnDate(n.declined)}</span>
                )}
              </span>
              {canChoose && (
                <button
                  type="button"
                  onClick={() => choose.mutate(d.id)}
                  disabled={choose.isPending}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60",
                    isMarked
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background text-foreground",
                  )}
                >
                  {choose.isPending && choose.variables === d.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {t.events.choose}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {choose.error && (
        <Notice tone="error" bare>
          {choose.error.message}
        </Notice>
      )}

      {exiting ? (
        <ExitConfirm event={event} onCancel={() => setExiting(false)} />
      ) : (
        <div className="flex items-baseline justify-between gap-4">
          <Link to={`/events/${event.id}/dates`} className="font-medium text-primary">
            {t.events.changeAnswers}
          </Link>
          <ExitLink event={event} onClick={() => setExiting(true)} />
        </div>
      )}
    </div>
  );
}
