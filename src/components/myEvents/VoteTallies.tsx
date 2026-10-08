import { Check, Clock, Loader2, Meh, X } from "lucide-react";

import { answerDate, chooseDate, type EventResponse } from "@/api/events";
import YourAnswer from "@/components/myEvents/YourAnswer";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
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
 * How a vote's dates stand (#74), in a computer's open event: each date to
 * come with how many can, would rather not, can't and haven't answered, and
 * your own answer on its right as a tick and a cross, changed with a click
 * right here (#103). The date ahead is only marked once half the group has
 * answered; before that every date is as good as the next. Nobody chooses
 * for the group while it votes: only when no date can win (every one has a
 * "can't") does the suggester get a Choose button on each, the best marked.
 * The phone's open vote is VoteSummary.
 */
export default function VoteTallies({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const choose = useEventChange((dateId: string) => chooseDate(event.id, dateId));
  const answer = useEventChange((v: { dateId: string; response: EventResponse }) =>
    answerDate(event.id, v.dateId, v.response),
  );
  const you = event.invitees.find((i) => i.isYou)?.profileId;
  const dates = upcomingDates(event);
  const total = event.invitees.length;
  const halfIn = (total - stillToAnswer(event).length) * 2 >= total;
  const mustChoose = voteStage(event) === "choose";
  const pointTo = mustChoose ? bestPick(event) : halfIn ? leader(event) : null;
  const canChoose = mustChoose && event.createdBy.isYou;

  return (
    <div>
      <ul className="flex flex-col gap-1.5">
        {dates.map((d) => {
          const n = tally(d, event);
          const marked = d.id === pointTo?.id;
          const label = formatEventDate(event.settings.kind, d, lang);
          // Shown as given while it saves.
          const yours =
            answer.isPending && answer.variables?.dateId === d.id
              ? answer.variables.response
              : you
                ? d.answers[you]
                : undefined;
          return (
            <li
              key={d.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card px-3 py-2",
                marked && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-muted-foreground">
                  <Count
                    icon={Check}
                    n={n.accepted}
                    label={t.swipe.answerWord.accepted}
                    tone="text-emerald-700"
                  />
                  <Count
                    icon={Meh}
                    n={n.maybe}
                    label={t.swipe.answerWord.maybe}
                    tone="text-amber-700"
                  />
                  <Count
                    icon={X}
                    n={n.declined}
                    label={t.swipe.answerWord.declined}
                    tone="text-rose-700"
                  />
                  <Count icon={Clock} n={n.missing} label={t.swipe.notAnswered} tone="" />
                  {marked && (
                    <span className="font-semibold text-primary">
                      {mustChoose ? t.events.bestPick : t.events.ahead}
                    </span>
                  )}
                </p>
              </div>
              {you && (
                <YourAnswer
                  yours={yours}
                  label={label}
                  disabled={answer.isPending}
                  onAnswer={(response) => answer.mutate({ dateId: d.id, response })}
                />
              )}
              {canChoose && (
                <button
                  type="button"
                  onClick={() => choose.mutate(d.id)}
                  disabled={choose.isPending}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60",
                    marked
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background text-foreground hover:bg-secondary",
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
      {(choose.error ?? answer.error) && (
        <Notice tone="error" bare className="mt-2">
          {(choose.error ?? answer.error)?.message}
        </Notice>
      )}
    </div>
  );
}

function Count({
  icon: Icon,
  n,
  label,
  tone,
}: {
  icon: typeof Check;
  n: number;
  label: string;
  tone: string;
}) {
  if (n === 0) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", tone)}
      title={label}
      aria-label={`${n} ${label}`}
    >
      <Icon className="h-3 w-3" />
      {n}
    </span>
  );
}
