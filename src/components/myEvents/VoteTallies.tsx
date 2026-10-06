import { Check, Clock, Loader2, Meh, X } from "lucide-react";

import { chooseDate } from "@/api/events";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { useLang, useT } from "@/i18n/lang";
import { formatEventDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bestPick, leader, tally, upcomingDates, voteStage, type VoteEvent } from "@/lib/vote";

/**
 * How a vote's dates stand (#74): each date to come with how many can, would
 * rather not, can't and haven't answered, the one ahead marked. Whoever
 * suggested it can settle it on any date from here, and is pointed to the
 * best one once every date has a decline. Shared by the phone's card and the
 * computer's open event.
 */
export default function VoteTallies({ event }: { event: VoteEvent }) {
  const t = useT();
  const { lang } = useLang();
  const choose = useEventChange((dateId: string) => chooseDate(event.id, dateId));
  const dates = upcomingDates(event);
  const ahead = leader(event);
  const mustChoose = voteStage(event) === "choose";
  const pointTo = mustChoose ? bestPick(event) : null;
  const canChoose = event.createdBy.isYou;

  return (
    <div>
      <ul className="flex flex-col gap-1.5">
        {dates.map((d) => {
          const n = tally(d, event);
          const marked = d.id === (pointTo ?? ahead)?.id;
          return (
            <li
              key={d.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card px-3 py-2",
                marked && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {formatEventDate(event.settings.kind, d, lang)}
                </p>
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
                      {pointTo ? t.events.bestPick : t.events.ahead}
                    </span>
                  )}
                </p>
              </div>
              {canChoose && (
                <button
                  type="button"
                  onClick={() => choose.mutate(d.id)}
                  disabled={choose.isPending}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60",
                    marked && mustChoose
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
      {canChoose && !mustChoose && (
        <p className="mt-2 text-xs text-muted-foreground">{t.events.chooseEarly}</p>
      )}
      {choose.error && (
        <Notice tone="error" bare className="mt-2">
          {choose.error.message}
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
