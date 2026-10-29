import { useLang } from "@/i18n/lang";
import { weekdayShortName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, localDate } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

const SIZES = {
  row: { box: "h-11 w-10 rounded-xl", day: "text-[19px]", weekday: "text-[9px]" },
  hero: { box: "h-16 w-14 rounded-2xl", day: "text-[28px]", weekday: "text-[11px]" },
} as const;

/**
 * An event's day as Apple Calendar's app icon draws one (#177): the weekday
 * small in orange over the day's number, so a row says when at a glance.
 * A vote not yet decided (`more`, its other dates) is a little stack of
 * them, its first date on top; one that is over is greyed.
 */
export default function DateTile({
  start,
  more = 0,
  past = false,
  size = "row",
}: {
  /** The day it is on: an agreed event's date, a vote's first date to come. */
  start: number | null;
  /** A vote's dates after the first: drawn as cards behind it. */
  more?: number;
  past?: boolean;
  size?: keyof typeof SIZES;
}) {
  const { lang } = useLang();
  const s = SIZES[size];
  const card = cn("flex flex-col items-center justify-center border bg-card", s.box);
  return (
    <span aria-hidden className="relative shrink-0">
      {more > 0 && (
        <>
          <span className={cn(card, "absolute inset-0 -translate-y-1 translate-x-1 opacity-60")} />
          {more > 1 && (
            <span
              className={cn(card, "absolute inset-0 -translate-y-2 translate-x-2 opacity-30")}
            />
          )}
        </>
      )}
      <span className={cn(card, "relative")}>
        {start === null ? (
          <span className={cn("font-semibold text-muted-foreground", s.day)}>?</span>
        ) : (
          <>
            <span
              className={cn(
                "font-bold uppercase leading-none tracking-wide",
                past ? "text-muted-foreground" : "text-primary",
                s.weekday,
              )}
            >
              {weekdayShortName(start, lang).replace(".", "")}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums leading-tight",
                past ? "text-muted-foreground" : "text-foreground",
                s.day,
              )}
            >
              {localDate(start, TZ).day}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
