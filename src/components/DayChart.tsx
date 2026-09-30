import { ChevronLeft, ChevronRight } from "lucide-react";

import { LOCALE, useLang, useT } from "@/i18n/lang";
import type { DayCell, MonthGrid } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

/**
 * The month as one bar per day: the taller the bar, the more of the group is
 * free (at the chosen time for a meeting, for that day of a trip). The answer
 * above the chart is the orange bar, or bars for a trip; the part of a bar
 * that only works if someone skips something or takes time off is amber.
 * Days that aren't searched, and days already gone, are flat grey stubs.
 *
 * Built from the same month grid the calendar view used (heatmap.ts), so the
 * numbers are the ones the search is based on. Clicking a day the whole
 * group can make moves the answer there.
 */
export default function DayChart({
  grid,
  bestDays,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPickDay,
  conditionalKind,
  timeZone,
}: {
  grid: MonthGrid;
  /** The zone the grid's days are local to, for the weekday letters. */
  timeZone: string;
  /** The answer's days (local-midnight ISO), highlighted. */
  bestDays: Set<string>;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPickDay: (dayIso: string) => void;
  /** What the amber part of a bar means here. */
  conditionalKind: "timeOff" | "skip";
}) {
  const t = useT();
  const { lang } = useLang();
  const days = grid.weeks.flat().filter((c) => c.inMonth);
  const title = grid.label.charAt(0).toUpperCase() + grid.label.slice(1);
  const bestNumbers = new Set(days.filter((c) => bestDays.has(c.date)).map((c) => c.dayOfMonth));

  function describe(c: DayCell) {
    return conditionalKind === "timeOff"
      ? t.scheduler.cellTitle(c.freeCount, c.total, c.conditionalCount)
      : t.scheduler.cellTitleSkip(c.freeCount, c.total, c.conditionalCount);
  }

  return (
    <section className="rounded-2xl border bg-card px-4 pb-4 pt-4 shadow-sm sm:px-7 sm:pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label={t.common.previousMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[15px] font-bold text-foreground sm:text-lg">
            {t.scheduler.chartTitle(title)}
          </h2>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label={t.common.nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="hidden flex-wrap items-center gap-4 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-everyone" />
            {t.scheduler.legendAll}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary/30" />
            {t.scheduler.legendFree}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-300" />
            {conditionalKind === "timeOff" ? t.scheduler.freeWithTimeOff : t.scheduler.freeIfSkipping}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-secondary" />
            {t.scheduler.legendOff}
          </span>
        </div>
      </div>

      {/* The bars, then the day numbers under them in the same columns. */}
      {/* The tallest bar is --bar-max: shorter on a phone, so the chart fits
          on the first screen under the answer. */}
      <div
        className="mt-4 flex items-end gap-[2px] border-b [--bar-max:110px] sm:mt-5 sm:gap-1.5 sm:[--bar-max:150px]"
        style={{ height: "calc(var(--bar-max) + 24px)" }}
      >
        {days.map((c) => {
          const dead = c.excluded || c.isPast;
          // Only a day the whole group can make (some by skipping or taking
          // time off) moves the answer; any other would land on the same one.
          const pickable = !dead && c.total > 0 && c.freeCount + c.conditionalCount >= c.total;
          const best = bestDays.has(c.date);
          const everyone = !dead && c.total > 0 && c.freeCount >= c.total;
          const freeH = dead ? 0 : c.freeCount / Math.max(c.total, 1);
          const condH = dead ? 0 : c.conditionalCount / Math.max(c.total, 1);
          return (
            <button
              key={c.date}
              type="button"
              disabled={dead}
              aria-disabled={!pickable}
              onClick={() => pickable && onPickDay(c.date)}
              title={dead ? undefined : describe(c)}
              aria-label={`${c.dayOfMonth}. ${dead ? t.scheduler.legendOff : describe(c)}`}
              className={cn(
                "group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1",
                pickable ? "cursor-pointer" : "cursor-default",
              )}
            >
              {!dead && (
                <span
                  className={cn(
                    "hidden text-[11px] font-bold sm:block",
                    best ? (everyone ? "text-everyone" : "text-primary") : "text-muted-foreground",
                  )}
                >
                  {/* Matches the bar's full stacked height (green + amber),
                      not just the outright-free count the green part alone
                      shows. */}
                  {c.freeCount + c.conditionalCount}
                </span>
              )}
              <span className="flex w-full flex-col justify-end">
                {condH > 0 && (
                  <span
                    className="w-full rounded-t-[4px] bg-amber-300"
                    style={{ height: `calc(var(--bar-max) * ${condH})` }}
                  />
                )}
                <span
                  className={cn(
                    "w-full transition-colors",
                    condH > 0 ? "" : "rounded-t-[4px]",
                    dead
                      ? "h-1.5 rounded-t-[3px] bg-secondary"
                      : everyone
                        ? best
                          ? "bg-everyone"
                          : "bg-everyone/45 group-hover:bg-everyone/65"
                        : best
                          ? "bg-primary"
                          : cn("bg-primary/30", pickable && "group-hover:bg-primary/50"),
                  )}
                  style={dead ? undefined : { height: `max(3px, calc(var(--bar-max) * ${freeH}))` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] sm:gap-1.5">
        {days.map((c) => {
          const best = bestDays.has(c.date);
          const everyone = !c.excluded && !c.isPast && c.total > 0 && c.freeCount >= c.total;
          const dow = new Date(c.date).toLocaleDateString(LOCALE[lang], {
            weekday: "narrow",
            timeZone,
          });
          return (
            <div
              key={c.date}
              className="flex min-w-0 flex-1 flex-col items-center text-[10px] leading-tight sm:text-xs"
            >
              <span
                className={cn(
                  "font-semibold",
                  // A phone has no room for 31 numbers: every fifth day, the
                  // first, and the answer's days.
                  // A number right beside the answer's would run into it.
                  !best &&
                    (c.dayOfMonth !== 1 && c.dayOfMonth % 5 !== 0
                      ? true
                      : bestNumbers.has(c.dayOfMonth - 1) || bestNumbers.has(c.dayOfMonth + 1)) &&
                    "invisible sm:visible",
                  best
                    ? cn("font-extrabold", everyone ? "text-everyone" : "text-primary")
                    : c.excluded || c.isPast
                      ? "text-muted-foreground/70"
                      : "text-foreground",
                )}
              >
                {c.dayOfMonth}
              </span>
              <span className="hidden text-muted-foreground sm:block">{dow}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
