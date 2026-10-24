import { type CandidateDate, type EventResponse } from "@/api/events";
import YourTime from "@/components/time/YourTime";
import Avatar from "@/components/ui/Avatar";
import { type MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { TODAY } from "@/hooks/useDateSearch";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline } from "@/lib/format";
import { type ImportantClash } from "@/lib/eventWarnings";
import { daysUntil } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { type VoteEvent } from "@/lib/vote";
import { APP_TIME_ZONE, dayOf } from "@/lib/zone";
import PlaceNote from "@/components/myEvents/PlaceNote";
import { clashesOn } from "@/components/swipe/clash";
import ImportantClashes from "@/components/swipe/ImportantClashes";
import { AnswerIcon } from "@/components/swipe/SwipeCard";

/** What a card says: the date, how soon, what you have then, and how others answered. */
const TZ = APP_TIME_ZONE;

export default function CardFace({
  event,
  date,
  position,
  total,
  yours,
  calendar,
  clashes,
  shownClash,
  onShowClash,
}: {
  event: VoteEvent;
  date: CandidateDate;
  position: number;
  total: number;
  yours: EventResponse | undefined;
  calendar: MyCalendarDays;
  /** What the date gets in the way of among your important events (#114). */
  clashes: ImportantClash[];
  /** The warning whose event is shown below (the card on top only). */
  shownClash?: string | null;
  onShowClash?: (clash: ImportantClash | null) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const headline = formatHeadline(event.settings, date, lang, t);
  const others = event.invitees.filter((i) => !i.isYou);
  const clash = clashesOn(date, calendar);

  return (
    <div className="flex h-full select-none flex-col rounded-3xl border bg-card p-5 shadow-xl shadow-black/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {t.swipe.dateOf(position, total)}
        </p>
        {/* How well it suits the group by everyone's important events (#119):
            one number for the group, there only when anyone shared something. */}
        {date.matchScore != null && (
          <span
            title={t.swipe.matchScoreNote}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              date.matchScore >= 85
                ? "bg-emerald-100 text-emerald-800"
                : date.matchScore >= 60
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800",
            )}
          >
            {t.swipe.matchScore(date.matchScore)}
          </span>
        )}
      </div>
      <p className="mt-2 text-[28px] font-extrabold leading-[1.1] tracking-tight text-foreground">
        {headline.lines.join(" ")}
      </p>
      <p className="mt-1 text-lg text-foreground">
        {headline.time}
        <YourTime kind={event.settings.kind} date={date} />
      </p>
      <p className="text-sm text-muted-foreground">
        {t.scheduler.inDays(daysUntil(dayOf(date.start, TZ), TODAY))}
      </p>
      {clash && (
        <p className="mt-2 text-sm font-medium text-rose-700">
          {t.swipe.clash(clash.label, clash.when, clash.more)}
        </p>
      )}
      <ImportantClashes
        clashes={clashes}
        shown={shownClash}
        onShow={onShowClash}
        className="mt-2"
      />
      <PlaceNote event={event} readOnly className="mt-3" />

      <div className="mt-auto pt-3">
        {yours && (
          <p className="mb-2 text-sm font-semibold text-foreground">
            {t.swipe.youAnswered(t.swipe.answerWord[yours])}
          </p>
        )}
        {others.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {others.map((p, i) => {
              const a = date.answers[p.profileId];
              return (
                <li
                  key={p.profileId}
                  className={cn(
                    "flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs",
                    a === "accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                    a === "maybe" && "border-amber-200 bg-amber-50 text-amber-800",
                    a === "declined" && "border-rose-200 bg-rose-50 text-rose-800",
                    !a && "bg-background text-muted-foreground",
                  )}
                >
                  <Avatar name={p.name} index={i + 1} size="xs" />
                  {p.name}
                  <AnswerIcon answer={a} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
