import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import DayColumns from "@/components/swipe/DayColumns";
import MonthView from "@/components/swipe/MonthView";
import { ZOOM } from "@/components/swipe/morph";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Whole days from `a` to `b`, both local midnights; rounded for the 23 and 25 hour days. */
const daysBetween = (a: number, b: number) => Math.round((b - a) / 86_400_000);

/** The Monday of the week `day` is in. */
const mondayOf = (day: number) => addDays(day, -((localDate(day, TZ).dow + 6) % 7), TZ);

/** The week row's slide, and its band's: the same quick, soft stop as the days. */
const SLIDE = { type: "spring", damping: 38, stiffness: 380, mass: 0.8 } as const;

/** How far a sideways swipe on the week row must go (px) to turn the week. */
const WEEK_SWIPE_AT = 40;

/**
 * Your calendar on the whole screen, opened from the strip under a swipe
 * card (#74) and laid out like Apple Calendar, so it reads as your own:
 *
 * - The day view: the same three days as the strip, larger (DayColumns),
 *   with Apple's week row on top, the day in the middle in a black circle
 *   (red if it is today), a grey band under the three, and a swipe on the
 *   row turning a whole week. The month name opens the month view.
 * - The month view (MonthView): month after month, a tap on a day opening
 *   it in the day view.
 *
 * It zooms out of the strip (`from`, the strip's place on screen) and back
 * into it: the whole calendar, scaled down evenly to the strip's width and
 * clipped to its shape, grows to the screen, so nothing inside is ever
 * stretched and nothing has to appear afterwards (morph.ts). "Færdig" closes
 * it; the pill bottom left goes back to the suggested date's day, from
 * either view.
 */
export default function CalendarSheet({
  date,
  slotLabel,
  marked,
  calendar,
  from,
  contained = false,
  onClose,
}: {
  date: { start: string; end: string };
  slotLabel: string;
  /** The vote's dates, as local midnights. */
  marked: ReadonlySet<number>;
  calendar: MyCalendarDays;
  /** Where the strip it grows out of is on screen; null for no zoom. */
  from: DOMRect | null;
  /**
   * A computer: the calendar fills the box it was opened in (the open
   * event), not the screen, and fits each whole day into its height.
   */
  contained?: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const home = startOfDay(start, TZ);
  const [view, setView] = useState<"day" | "month">("day");
  const pencil = useMemo(
    () => ({ start: Date.parse(date.start), end: Date.parse(date.end), label: slotLabel }),
    [date.start, date.end, slotLabel],
  );
  // Days moved from the suggested one: the day view shows the day before
  // the middle one, it, and the day after.
  const [offset, setOffset] = useState(0);
  const center = addDays(home, offset, TZ);
  const inView = [-1, 0, 1].map((i) => addDays(center, i, TZ));
  // Today, for the red circle: fixed for as long as the calendar is open.
  const [today] = useState(() => startOfDay(Date.now(), TZ));
  // Which way the week row last turned, for its slide.
  const [weekTurn, setWeekTurn] = useState(0);
  const monday = mondayOf(center);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i, TZ));

  /** Show `to` days from the suggested one in the middle, turning the week row if it changes week. */
  const go = (to: number) => {
    setWeekTurn(Math.sign(mondayOf(addDays(home, to, TZ)) - monday));
    setOffset(to);
  };

  // The zoom: from the strip's place, scaled evenly and clipped to its
  // shape, to the whole screen; and back on closing.
  const sheet = useRef<HTMLDivElement>(null);
  const days = useRef<HTMLDivElement>(null);
  const zoomedOut = useRef<Keyframe | null>(null);
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el || !from || reduceMotion) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const scale = from.width / width;
    // The day columns' top, lined up with the strip's top.
    const top = days.current?.offsetTop ?? 0;
    const below = Math.max(height - top - from.height / scale, 0);
    // Where the strip is, from the box the calendar fills: the screen, or
    // on a computer the open event.
    const host = el.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const left = from.left - host.left;
    const stripTop = from.top - host.top;
    zoomedOut.current = {
      transform: `translate(${left}px, ${stripTop - top * scale}px) scale(${scale})`,
      clipPath: `inset(${top}px 0px ${below}px 0px round ${14 / scale}px)`,
      opacity: 0,
    };
    el.animate(
      [
        zoomedOut.current,
        { opacity: 1, offset: 0.3 },
        {
          transform: "translate(0px, 0px) scale(1)",
          clipPath: "inset(0px 0px 0px 0px round 0px)",
          opacity: 1,
        },
      ],
      { duration: ZOOM.inMs, easing: ZOOM.easing },
    );
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [closing, setClosing] = useState(false);
  const close = () => {
    const el = sheet.current;
    if (closing) return;
    setClosing(true);
    if (!el || reduceMotion) return onClose();
    // Back into the strip only from the day view it grew out of; from
    // anywhere else it fades, as a zoom into a different picture would jar.
    if (!zoomedOut.current || view !== "day" || offset !== 0) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        fill: "forwards",
      }).finished.then(onClose, onClose);
      return;
    }
    el.animate(
      [
        {
          transform: "translate(0px, 0px) scale(1)",
          clipPath: "inset(0px 0px 0px 0px round 0px)",
          opacity: 1,
        },
        { opacity: 1, offset: 0.7 },
        zoomedOut.current,
      ],
      { duration: ZOOM.outMs, easing: ZOOM.easing, fill: "forwards" },
    ).finished.then(onClose, onClose);
  };

  // A computer's keys: left and right a day, Escape closes.
  const keys = useRef({ go, offset, close });
  useEffect(() => {
    keys.current = { go, offset, close };
  });
  useEffect(() => {
    if (!contained) return;
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === "ArrowLeft") k.go(k.offset - 1);
      else if (e.key === "ArrowRight") k.go(k.offset + 1);
      else if (e.key === "Escape") k.close();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contained]);

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
        go(offset + (dx < 0 ? 7 : -7));
      }
    },
    onPointerCancel: () => {
      swipe.current = null;
    },
  };

  const shown = week.map((d, i) => (inView.includes(d) ? i : -1)).filter((i) => i >= 0);
  const month = capitalize(
    new Date(center).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  const pill =
    "flex h-10 items-center rounded-full border bg-card text-[17px] font-medium text-foreground shadow-sm";

  return (
    <div
      ref={sheet}
      role="dialog"
      aria-modal
      aria-label={t.swipe.yourCalendar}
      className={cn(
        "flex flex-col overflow-hidden bg-background",
        contained
          ? "absolute inset-0 z-30 rounded-2xl"
          : "fixed inset-0 z-[70] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]",
      )}
      style={{ transformOrigin: "0 0" }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between px-3">
        {view === "day" ? (
          <button
            type="button"
            onClick={() => setView("month")}
            aria-label={t.swipe.showMonth(month)}
            className={cn(pill, "gap-1 pl-2 pr-4")}
          >
            <ChevronLeft className="h-5 w-5" />
            {month}
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={close} className={cn(pill, "px-4 font-semibold")}>
          {t.swipe.done}
        </button>
      </header>

      <AnimatePresence mode="popLayout" initial={false}>
        {view === "day" ? (
          <motion.div
            key="day"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {/* The week: letters fixed, numbers turning a week at a time. */}
            <div className="mx-1 flex shrink-0 items-end gap-1 pb-2">
              {/* A computer turns the week with arrows; a phone swipes the row. */}
              {contained && (
                <button
                  type="button"
                  onClick={() => go(offset + -7)}
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
                  <AnimatePresence initial={false} custom={weekTurn}>
                    <motion.div
                      key={monday}
                      custom={weekTurn}
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
                            onClick={() => go(daysBetween(home, day))}
                            className="flex items-center justify-center"
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-full text-[19px] transition-colors",
                                day === center
                                  ? day === today
                                    ? "bg-red-500 font-semibold text-white"
                                    : "bg-foreground font-semibold text-background"
                                  : day === today
                                    ? "font-semibold text-red-500"
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
              {contained && (
                <button
                  type="button"
                  onClick={() => go(offset + 7)}
                  aria-label={t.swipe.weekOn}
                  className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div ref={days} className="min-h-0 flex-1 border-t">
              <DayColumns
                home={home}
                offset={offset}
                onOffset={go}
                slot={{ start, end }}
                slotLabel={slotLabel}
                calendar={calendar}
                size="full"
                fitDay={contained}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="month"
            className="min-h-0 flex-1"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <MonthView
              focus={center}
              calendar={calendar}
              pencil={pencil}
              marked={marked}
              onPickDay={(day) => {
                go(daysBetween(home, day));
                setView("day");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {(offset !== 0 || view === "month") && (
        <button
          type="button"
          onClick={() => {
            // Always the suggested date's own day, from the month view too.
            go(0);
            setView("day");
          }}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] left-4 z-30 rounded-full border bg-card/90 px-5 py-2.5 text-[17px] font-medium text-foreground shadow-lg backdrop-blur"
        >
          {t.swipe.toSuggestion}
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
