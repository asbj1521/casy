import { useLayoutEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import FadeSwap from "@/components/FadeSwap";
import {
  BAR_SETTLE_SECONDS,
  barRiseDelay,
  nextChartMotion,
  RISE_FULL,
  type ChartMotion,
  type ChartView,
} from "@/lib/barRise";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { cardArrived, cardTransitionRunning, CARD_LANDS_S } from "@/lib/cardTransition";
import type { DayCell, MonthAvailability } from "@/lib/monthAvailability";
import { cn } from "@/lib/utils";

/**
 * The month as one bar per day: the taller the bar, the more of the group is
 * free (at the chosen time for a meeting, for that day of a trip). The answer
 * above the chart is the orange bar, or bars for a trip; the part of a bar
 * that only works if someone skips something or takes time off is amber.
 * Days that aren't searched, and days already gone, are flat grey stubs.
 *
 * Its numbers come from the same settings and rules as the search
 * (monthAvailability.ts), so the chart shows why the answer is what it is.
 * Clicking a day the whole group can make moves the answer there.
 *
 * When it first appears, or its data arrives, the bars rise left to right,
 * each count carried up on its bar and each date coming in with it. When the
 * month changes, the old month slides out and the new one in, like a
 * carousel. A group switch only fades (FadeSwap). A settings change glides
 * every bar to its new height at once and fades its colour, so a day that
 * gains people grows and one that loses them sinks. The landing page's
 * drawing uses the same rise.
 *
 * While the group's calendars load (`loading`) the chart is already there in
 * its final shape, flat bars under a placeholder title, so the page doesn't
 * jump when the numbers arrive: the bars rise out of it instead.
 */
export default function DayChart({
  month,
  bestDays,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPickDay,
  conditionalKind,
  timeZone,
  swapKey = "",
  loading = false,
}: {
  /** The calendars aren't in yet: flat bars, nothing to click. */
  loading?: boolean;
  /** When it changes (another group), the chart's contents fade over; the box stays. */
  swapKey?: string;
  month: MonthAvailability;
  /** The zone the month's days are local to, for the weekday letters. */
  timeZone: string;
  /** The answer's days (local-midnight ISO), highlighted. */
  bestDays: ReadonlySet<string>;
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
  const { days, total } = month;
  /** The whole group can make it outright: a green bar. */
  const everyoneOn = (c: DayCell) => !c.excluded && !c.isPast && total > 0 && c.freeCount >= total;

  // How the chart moves as it changes (nextChartMotion). Kept in state and
  // updated during render (React's pattern for following a changed value), so
  // the render that mounts the new bars already knows why they are new.
  // The month by its first day, not its label, which changes with the language.
  const monthKey = days[0]?.date ?? "";
  const [last, setLast] = useState<ChartView & { motion: ChartMotion }>({
    swapKey,
    month: monthKey,
    loading,
    motion: { kind: "rise" },
  });
  if (swapKey !== last.swapKey || monthKey !== last.month || loading !== last.loading) {
    const view = { swapKey, month: monthKey, loading };
    setLast({ ...view, motion: nextChartMotion(last, view, last.motion) });
  }
  // The rise animates heights, which MotionConfig's reduced-motion setting
  // (transforms only) wouldn't catch, so reduced motion is handled here.
  const reduceMotion = useReducedMotion();
  const chartMotion = reduceMotion ? null : last.motion;
  const rise = chartMotion?.kind === "rise";
  const slide = {
    on: chartMotion?.kind === "slide",
    back: chartMotion?.kind === "slide" && chartMotion.back,
  };
  // Arriving from the landing page's "Go to Casy" (cardTransition.ts), the
  // card is still flying into place: the bars wait until it has landed.
  const [arriving] = useState(cardTransitionRunning);
  useLayoutEffect(cardArrived, []);
  const riseDelay = (i: number) => barRiseDelay(i, RISE_FULL, arriving ? CARD_LANDS_S : undefined);
  const riseTransition = (i: number) =>
    rise
      ? { duration: RISE_FULL.duration, delay: riseDelay(i), ease: "easeOut" as const }
      : { duration: 0 };
  // A settings change: each bar glides to its new height, and colours and
  // dimming fade over the same time (CSS transitions, paced from here).
  const settle = { duration: reduceMotion ? 0 : BAR_SETTLE_SECONDS, ease: "easeOut" as const };
  const fade = { transitionDuration: `${settle.duration}s` };
  const bestNumbers = new Set(days.filter((c) => bestDays.has(c.date)).map((c) => c.dayOfMonth));

  function describe(c: DayCell) {
    return conditionalKind === "timeOff"
      ? t.scheduler.cellTitle(c.freeCount, total, c.conditionalCount)
      : t.scheduler.cellTitleSkip(c.freeCount, total, c.conditionalCount);
  }

  return (
    // The vt- classes name the card and its contents for the landing page's
    // transition (cardTransition.ts, index.css): the card flies in, the
    // contents fade in once it has landed.
    <section className="vt-card rounded-2xl border bg-card px-4 pb-4 pt-3 shadow-sm sm:px-7 sm:pt-5">
      <div className="vt-card-content">
        <FadeSwap swapKey={swapKey} playChildrenOnLoad>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev || loading}
                aria-label={t.common.previousMonth}
                className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-[15px] font-bold text-foreground sm:text-lg">
                {loading ? (
                  // The real title's size, kept blank until the month is known.
                  <span className="animate-pulse rounded-md bg-secondary text-transparent">
                    {t.scheduler.chartTitle(month.label)}
                  </span>
                ) : (
                  t.scheduler.chartTitle(month.label)
                )}
              </h2>
              <button
                type="button"
                onClick={onNext}
                disabled={!canNext || loading}
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
                {conditionalKind === "timeOff"
                  ? t.scheduler.freeWithTimeOff
                  : t.scheduler.freeIfSkipping}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-secondary" />
                {t.scheduler.legendOff}
              </span>
            </div>
          </div>

          {/* Paging months slides the old month out and the new one in; the
          title and legend stay put. AnimatePresence keeps its default
          `initial`: false would also silence the bars' own first rise. The
          gap above sits on this wrapper, not the bars: popLayout makes the
          outgoing month absolute, where a margin inside it stops collapsing
          and would drop that month by the margin as it leaves. */}
          <div className="relative mt-3 overflow-hidden sm:mt-5">
            <AnimatePresence mode="popLayout" custom={slide}>
              <motion.div
                key={monthKey}
                custom={slide}
                variants={SLIDE}
                initial={slide.on ? "enter" : false}
                animate="center"
                exit="exit"
              >
                {/* The bars, then the day numbers under them in the same columns. */}
                {/* The tallest bar is --bar-max: shorter on a phone, so the chart fits
          on the first screen under the answer. */}
                <div
                  className="flex items-end gap-[2px] border-b [--bar-max:78px] sm:gap-1.5 sm:[--bar-max:150px]"
                  style={{ height: "calc(var(--bar-max) + 24px)" }}
                >
                  {days.map((c, i) => {
                    const dead = c.excluded || c.isPast;
                    // Only a day the whole group can make (some by skipping or taking
                    // time off) moves the answer; any other would land on the same one.
                    const pickable =
                      !loading && !dead && total > 0 && c.freeCount + c.conditionalCount >= total;
                    const best = bestDays.has(c.date);
                    const everyone = everyoneOn(c);
                    const freeH = dead ? 0 : c.freeCount / Math.max(total, 1);
                    const condH = dead ? 0 : c.conditionalCount / Math.max(total, 1);
                    return (
                      <button
                        key={c.date}
                        type="button"
                        disabled={dead || loading}
                        aria-disabled={!pickable}
                        onClick={() => pickable && onPickDay(c.date)}
                        title={dead || loading ? undefined : describe(c)}
                        aria-label={`${c.dayOfMonth}. ${loading ? "" : dead ? t.scheduler.legendOff : describe(c)}`}
                        className={cn(
                          "group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 transition-opacity",
                          pickable ? "cursor-pointer" : "cursor-default",
                          // A day the group can't make, even by skipping, steps back so
                          // the ones worth picking stand out.
                          !loading && !dead && !pickable && "opacity-35",
                        )}
                        style={fade}
                      >
                        {/* Kept for days out of the search too, only faded out, so a
                  weekday switched off or on fades its count with its bar. */}
                        {!loading && (
                          <span
                            className={cn(
                              "hidden transition-opacity sm:block",
                              dead && "opacity-0",
                            )}
                            style={fade}
                          >
                            <motion.span
                              className={cn(
                                "block text-[11px] font-bold transition-colors",
                                best
                                  ? everyone
                                    ? "text-everyone"
                                    : "text-primary"
                                  : "text-muted-foreground",
                              )}
                              style={fade}
                              initial={rise ? { opacity: 0 } : false}
                              animate={{ opacity: 1 }}
                              transition={
                                rise ? { duration: 0.2, delay: riseDelay(i) } : { duration: 0 }
                              }
                            >
                              {/* Matches the bar's full stacked height (green + amber),
                        not just the outright-free count the green part alone
                        shows. */}
                              {c.freeCount + c.conditionalCount}
                            </motion.span>
                          </span>
                        )}
                        {/* The bar's height is --bar-max times the share of the group
                  free (--free, green) or free only by skipping (--cond,
                  amber), times --grow. Real heights, not transforms, so the
                  count on top is carried with them. --grow (0 to 1) is the
                  rise; --free and --cond glide to a settings change's new
                  numbers. The rise mounts them already at their values, and
                  the key remounts the bar when the data arrives, so the two
                  never run on top of each other. The rounding sits on the
                  whole bar, so it doesn't jump between green and amber as
                  the amber part grows in or shrinks away. */}
                        <motion.span
                          key={loading ? "loading" : "ready"}
                          className={cn(
                            "flex w-full flex-col justify-end overflow-hidden",
                            loading || dead ? "rounded-t-[3px]" : "rounded-t-[4px]",
                          )}
                          initial={rise ? { "--grow": 0, "--free": freeH, "--cond": condH } : false}
                          animate={{ "--grow": loading ? 0 : 1, "--free": freeH, "--cond": condH }}
                          transition={{ default: settle, "--grow": riseTransition(i) }}
                        >
                          <span
                            className="w-full bg-amber-300"
                            style={{
                              height: "calc(var(--bar-max) * var(--cond, 0) * var(--grow, 1))",
                            }}
                          />
                          <span
                            className={cn(
                              "w-full transition-colors",
                              loading || dead
                                ? "bg-secondary"
                                : everyone
                                  ? best
                                    ? "bg-everyone"
                                    : "bg-everyone/45 group-hover:bg-everyone/65"
                                  : best
                                    ? "bg-primary"
                                    : cn("bg-primary/30", pickable && "group-hover:bg-primary/50"),
                            )}
                            style={{
                              ...fade,
                              // Days out of the search, and every day while loading, are
                              // flat stubs; --free is 0 for them, so a day switched off
                              // sinks to the stub rather than vanishing.
                              height: `max(${loading || dead ? "6px" : "3px"}, calc(var(--bar-max) * var(--free, 0) * var(--grow, 1)))`,
                            }}
                          />
                        </motion.span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-[2px] sm:gap-1.5">
                  {days.map((c, i) => {
                    const best = bestDays.has(c.date);
                    const everyone = everyoneOn(c);
                    const dow = new Date(c.date).toLocaleDateString(LOCALE[lang], {
                      weekday: "narrow",
                      timeZone,
                    });
                    return (
                      <motion.div
                        key={c.date}
                        className="flex min-w-0 flex-1 flex-col items-center text-[10px] leading-tight sm:text-xs"
                        initial={rise ? { opacity: 0, y: 6 } : false}
                        animate={loading ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
                        transition={riseTransition(i)}
                      >
                        <span
                          style={fade}
                          className={cn(
                            "font-semibold transition-colors",
                            // A phone has no room for 31 numbers: every fifth day, the
                            // first, and the answer's days.
                            // A number right beside the answer's would run into it.
                            !best &&
                              (c.dayOfMonth !== 1 && c.dayOfMonth % 5 !== 0
                                ? true
                                : bestNumbers.has(c.dayOfMonth - 1) ||
                                  bestNumbers.has(c.dayOfMonth + 1)) &&
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
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </FadeSwap>
      </div>
    </section>
  );
}

/** A month change's slide, forward or `back`; any other change swaps at once. */
const SLIDE_SECONDS = 0.35;
const SLIDE: Variants = {
  enter: ({ back }: { back: boolean }) => ({ x: back ? "-100%" : "100%" }),
  center: { x: 0, transition: { duration: SLIDE_SECONDS, ease: "easeInOut" } },
  exit: ({ on, back }: { on: boolean; back: boolean }) =>
    on
      ? { x: back ? "100%" : "-100%", transition: { duration: SLIDE_SECONDS, ease: "easeInOut" } }
      : { opacity: 0, transition: { duration: 0 } },
};
