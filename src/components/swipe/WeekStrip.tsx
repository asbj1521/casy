import { useRef, type PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TODAY_TONE, type TodayTone } from "@/components/swipe/todayTone";
import { useT } from "@/i18n/lang";
import { mondayOf } from "@/lib/dayColumns";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** The week row's slide, and its band's: the same quick, soft stop as the days. */
const SLIDE = { type: "spring", damping: 38, stiffness: 380, mass: 0.8 } as const;

/** How far a sideways swipe on the week row must go (px) to turn the week. */
const WEEK_SWIPE_AT = 40;

/**
 * Apple's week row over its day view (#74, #176): the weekdays' letters
 * fixed, the numbers turning a week at a time, the day in view in a black
 * circle (red if it is today), a grey band under all the days in view, and
 * a sideways swipe on the row turning a whole week. A tap on a number shows
 * that day. A computer turns the week with arrows either side (`arrows`).
 */
export default function WeekStrip({
  center,
  inView,
  today,
  marked,
  turn,
  onPick,
  onWeek,
  arrows = false,
  tone = "red",
}: {
  /** The day in the circle: the swipe screen's middle day, the home page's first. */
  center: number;
  /** Every day in view, under the grey band. */
  inView: readonly number[];
  today: number;
  /** Days drawn in bold orange (a vote's dates). */
  marked: ReadonlySet<number>;
  /** Which way the week last turned (-1, 0 or 1), for its slide. */
  turn: number;
  onPick: (day: number) => void;
  /** Turn a week back (-1) or on (1). */
  onWeek: (direction: -1 | 1) => void;
  arrows?: boolean;
  /** Today's colour: Apple's red, or Casy's orange. */
  tone?: TodayTone;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const monday = mondayOf(center, TZ);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i, TZ));
  const shown = week.map((d, i) => (inView.includes(d) ? i : -1)).filter((i) => i >= 0);

  // A sideways swipe on the week row turns the week.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const weekSwipe = {
    onPointerDown: (e: PointerEvent) => {
      swipe.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = swipe.current;
      swipe.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) > WEEK_SWIPE_AT && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
        onWeek(dx < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => {
      swipe.current = null;
    },
  };

  return (
    <div className="mx-1 flex shrink-0 items-end gap-1 pb-2">
      {arrows && (
        <button
          type="button"
          onClick={() => onWeek(-1)}
          aria-label={t.swipe.weekBack}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-7">
          {week.map((day) => (
            <span
              key={day}
              className={cn(
                "text-center text-[12px] font-medium",
                isWeekend(day) ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {t.weekdaysShort[localDate(day, TZ).dow].charAt(0)}
            </span>
          ))}
        </div>
        <div
          className="relative mt-1 h-10 overflow-hidden"
          style={{ touchAction: "pan-y" }}
          {...weekSwipe}
        >
          <AnimatePresence initial={false} custom={turn}>
            <motion.div
              key={monday}
              custom={turn}
              variants={{
                enter: (d: number) => ({ x: `${d * 100}%` }),
                still: { x: 0 },
                leave: (d: number) => ({ x: `${-d * 100}%` }),
              }}
              initial="enter"
              animate="still"
              exit="leave"
              transition={reduceMotion ? { duration: 0 } : SLIDE}
              className="absolute inset-0"
            >
              {shown.length > 0 && (
                <motion.div
                  aria-hidden
                  className="absolute inset-y-0 rounded-full bg-secondary"
                  initial={false}
                  animate={{
                    left: `${(shown[0] / 7) * 100}%`,
                    width: `${(shown.length / 7) * 100}%`,
                  }}
                  transition={reduceMotion ? { duration: 0 } : SLIDE}
                />
              )}
              <div className="relative grid h-full grid-cols-7">
                {week.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onPick(day)}
                    className="flex items-center justify-center"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-[19px] transition-colors",
                        day === center
                          ? day === today
                            ? cn(TODAY_TONE[tone].fill, "font-semibold text-white")
                            : "bg-foreground font-semibold text-background"
                          : day === today
                            ? cn(TODAY_TONE[tone].text, "font-semibold")
                            : marked.has(day)
                              ? "font-bold text-primary"
                              : isWeekend(day)
                                ? "text-muted-foreground"
                                : "text-foreground",
                      )}
                    >
                      {localDate(day, TZ).day}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {arrows && (
        <button
          type="button"
          onClick={() => onWeek(1)}
          aria-label={t.swipe.weekOn}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Saturday and Sunday, greyed in the week row as Apple does. */
function isWeekend(day: number): boolean {
  const { dow } = localDate(day, TZ);
  return dow === 0 || dow === 6;
}
