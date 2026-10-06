import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import DayColumns from "@/components/swipe/DayColumns";
import { CONTENT_IN, CONTENT_OUT_MS, MORPH } from "@/components/swipe/morph";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Whole days from `a` to `b`, both local midnights; rounded for the 23 and 25 hour days. */
const daysBetween = (a: number, b: number) => Math.round((b - a) / 86_400_000);

/**
 * The strip under a swipe card grown to the whole screen (#74): the same
 * three days, now larger and in full (DayColumns), so opening it shows more
 * of what you were already looking at rather than something else. Laid out
 * like Apple Calendar: the month as a back button, the week with the days in
 * view marked, a sideways swipe a day at a time, and a pill back to the
 * suggested date once you've moved, where Apple has "I dag".
 *
 * It grows out of the strip through their shared `layoutId`, and shrinks
 * back into it on closing. Only the empty box morphs: its contents fade in
 * once it has its full size, and out before it shrinks (morph.ts).
 */
export default function CalendarSheet({
  date,
  slotLabel,
  marked,
  calendar,
  layoutId,
  onClose,
}: {
  date: { start: string; end: string };
  slotLabel: string;
  /** The vote's dates, as local midnights, marked in the week row. */
  marked: ReadonlySet<number>;
  calendar: MyCalendarDays;
  layoutId: string;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const home = startOfDay(start, TZ);
  // Days moved from the suggested one: the strip shows the day before it,
  // it, and the day after.
  const [offset, setOffset] = useState(0);
  const center = addDays(home, offset, TZ);
  const inView = [-1, 0, 1].map((i) => addDays(center, i, TZ));
  // Today, for the red circle: fixed for as long as the calendar is open.
  const [today] = useState(() => startOfDay(Date.now(), TZ));
  // The days are drawn once the box has grown, so the tap starts the morph
  // at once instead of waiting for them, and nothing is stretched with it.
  const [grown, setGrown] = useState(!!reduceMotion);
  useEffect(() => {
    if (grown) return;
    const id = setTimeout(() => setGrown(true), MORPH.duration * 1000);
    return () => clearTimeout(id);
  }, [grown]);
  // Closing: the contents fade out first, then the box shrinks back.
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    if (reduceMotion) return onClose();
    setClosing(true);
    setTimeout(onClose, CONTENT_OUT_MS);
  };

  // The week the middle day is in, Monday first, as Apple's row shows it,
  // with one grey band under the days in view that slides as they change.
  const monday = addDays(center, -((localDate(center, TZ).dow + 6) % 7), TZ);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i, TZ));
  const shown = week.map((d, i) => (inView.includes(d) ? i : -1)).filter((i) => i >= 0);
  const band = { left: `${(shown[0] / 7) * 100}%`, width: `${(shown.length / 7) * 100}%` };
  const month = capitalize(
    new Date(center).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );

  return (
    <motion.div
      layoutId={reduceMotion ? undefined : layoutId}
      transition={MORPH}
      role="dialog"
      aria-modal
      aria-label={t.swipe.yourCalendar}
      className="fixed inset-0 z-[70] overflow-hidden bg-background"
      style={{ borderRadius: 0 }}
    >
      <motion.div
        className="flex h-full flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={closing ? { duration: CONTENT_OUT_MS / 1000 } : CONTENT_IN}
      >
        <header className="flex h-14 shrink-0 items-center px-3">
          <button
            type="button"
            onClick={close}
            aria-label={t.swipe.closeCalendar}
            className="flex h-10 items-center gap-1 rounded-full border bg-card pl-2 pr-4 text-[17px] font-medium text-foreground shadow-sm"
          >
            <ChevronLeft className="h-5 w-5" />
            {month}
          </button>
        </header>

        {/* The week, the days in view on a grey band, today in red. */}
        <div className="relative mx-1 shrink-0 pb-2">
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
          <div className="relative mt-1 h-10">
            {shown.length > 0 && (
              <motion.div
                aria-hidden
                className="absolute inset-y-0 rounded-full bg-secondary"
                initial={false}
                animate={band}
                transition={reduceMotion ? { duration: 0 } : SLIDE}
              />
            )}
            <div className="relative grid h-full grid-cols-7">
              {week.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setOffset(daysBetween(home, day))}
                  className="flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-[19px]",
                      day === today
                        ? "bg-red-500 font-semibold text-white"
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
          </div>
        </div>

        <div className="min-h-0 flex-1 border-t">
          {grown && (
            <DayColumns
              home={home}
              offset={offset}
              onOffset={setOffset}
              slot={{ start, end }}
              slotLabel={slotLabel}
              calendar={calendar}
              size="full"
            />
          )}
        </div>

        {offset !== 0 && (
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] left-4 z-30 rounded-full border bg-card/90 px-5 py-2.5 text-[17px] font-medium text-foreground shadow-lg backdrop-blur"
          >
            {t.swipe.toSuggestion}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Saturday and Sunday, greyed in the week row as Apple does. */
function isWeekend(day: number): boolean {
  const { dow } = localDate(day, TZ);
  return dow === 0 || dow === 6;
}

/** The band's slide: the same quick, soft stop as the days under it. */
const SLIDE = { type: "spring", damping: 38, stiffness: 380, mass: 0.8 } as const;
