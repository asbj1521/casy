import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import DayColumns from "@/components/swipe/DayColumns";
import { MORPH } from "@/components/swipe/morph";
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
 * back into it on closing; its contents fade in once it has room.
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
  // Days moved from the suggested one, and which way the last move went.
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState(0);
  const center = addDays(home, offset, TZ);
  const days = [-1, 0, 1].map((i) => addDays(center, i, TZ));
  // Today, for the red circle: fixed for as long as the calendar is open.
  const [today] = useState(() => startOfDay(Date.now(), TZ));

  const moveTo = (newOffset: number) => {
    setDirection(Math.sign(newOffset - offset));
    setOffset(newOffset);
  };

  // The week the middle day is in, Monday first, as Apple's row shows it.
  const monday = addDays(center, -((localDate(center, TZ).dow + 6) % 7), TZ);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i, TZ));
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.14, duration: 0.2 }}
      >
        <header className="flex h-14 shrink-0 items-center px-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={t.swipe.closeCalendar}
            className="flex h-10 items-center gap-1 rounded-full border bg-card pl-2 pr-4 text-[17px] font-medium text-foreground shadow-sm"
          >
            <ChevronLeft className="h-5 w-5" />
            {month}
          </button>
        </header>

        {/* The week, the days in view on a grey band, today in red. */}
        <div className="grid shrink-0 grid-cols-7 px-1 pb-2">
          {week.map((day) => {
            const { day: n, dow } = localDate(day, TZ);
            const inView = days.includes(day);
            const weekend = dow === 0 || dow === 6;
            return (
              <button
                key={day}
                type="button"
                onClick={() => moveTo(daysBetween(home, day))}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "text-[12px] font-medium",
                    weekend ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {t.weekdaysShort[dow].charAt(0)}
                </span>
                <span
                  className={cn(
                    "flex h-10 w-full items-center justify-center",
                    inView && "bg-secondary",
                    inView && !days.includes(addDays(day, -1, TZ)) && "rounded-l-full",
                    inView && !days.includes(addDays(day, 1, TZ)) && "rounded-r-full",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-[19px]",
                      day === today
                        ? "bg-red-500 font-semibold text-white"
                        : marked.has(day)
                          ? "font-bold text-primary"
                          : weekend
                            ? "text-muted-foreground"
                            : "text-foreground",
                    )}
                  >
                    {n}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 border-t">
          <DayColumns
            days={days}
            slot={{ start, end }}
            slotLabel={slotLabel}
            calendar={calendar}
            size="full"
            direction={direction}
            onSwipe={(dir) => moveTo(offset + dir)}
          />
        </div>

        {offset !== 0 && (
          <button
            type="button"
            onClick={() => moveTo(0)}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] left-4 z-30 rounded-full border bg-card/90 px-5 py-2.5 text-[17px] font-medium text-foreground shadow-lg backdrop-blur"
          >
            {t.swipe.toSuggestion}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
