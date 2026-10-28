import { useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { Check, ChevronDown, Loader2, TriangleAlert, X } from "lucide-react";

import { useLang, useT } from "@/i18n/lang";
import { type EventSettings } from "@/lib/eventSearch";
import { capitalize, dayLabel, formatEventDate, formatTime } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { checkTimes, liveOrder, PILE_TIMING, rankOrder } from "@/lib/paperPile";
import { cn } from "@/lib/utils";
import {
  type Phase,
  SCROLL_START_MS,
  SCROLL_PX_PER_S,
  SCROLL_MIN_S,
  SCROLL_MAX_S,
  ARRIVAL_PAUSE_MS,
  SCROLL_TICK_PX,
  type CheckedDate,
  type Flight,
} from "./shared";

/**
 * The dates as a list over the calendar. Each one flies up out of its green
 * circle and stretches into a row (measured, then animated from the circle
 * to the row: a FLIP); dates in other months rise from below. Then they are
 * checked one at a time, under one line that stays put ("Gennemgår
 * kalenderne"): a spinner on the row, then a tick (offered in the vote) or
 * a cross, and at once it moves to its place (liveOrder): a good one rises
 * among the best, the others slide down through the list to the bottom,
 * quicker and quicker until dates fly past each other. When the last has
 * settled the list is the ranking (rankOrder), numbered, and a row opens
 * to what Casy found about it.
 */
export default function DateList({
  items,
  meeting,
  kind,
  phase,
  instant,
  scroll,
  onTaken,
  onArrived,
  onRanked,
}: {
  items: CheckedDate[];
  meeting: boolean;
  kind: EventSettings["kind"];
  phase: Phase;
  instant: boolean;
  /** The shared calendar's scroll, which this list drives to lift each date out. */
  scroll: MotionValue<number>;
  /** A date's green circle has turned into its row: the calendar stops showing it. */
  onTaken: (day: number) => void;
  /** Every date is in the list. */
  onArrived: () => void;
  onRanked: () => void;
}) {
  const t = useT();
  const words = t.planFromCalendar;
  const { lang } = useLang();
  const rows = useRef(new Map<string, HTMLElement>());
  const [flights, setFlights] = useState<Record<string, Flight>>({});
  const [open, setOpen] = useState<string | null>(null);
  const done = phase === "done";
  const ranking = phase === "ranking";

  // The dates arriving, in their order: the shared calendar scrolls up
  // until the next date's green circle is level with its empty row, stops,
  // the circle turns into the row, and on to the next. A date already level
  // or past (two in one week) turns into its row at once; one without a
  // circle (someone gives something up for it) just appears. Measured live
  // each time, so the scroll and the rows can never disagree.
  useEffect(() => {
    if (phase !== "lifted" || instant) return;
    let stopped = false;
    let running: AnimationPlaybackControls | null = null;
    const wait = (ms: number) => new Promise((done) => window.setTimeout(done, ms));
    const circleOf = (day: number) =>
      document.querySelector(`[data-shared] [data-shine="${day}"]`)?.getBoundingClientRect();
    // A light tick for every stretch the calendar scrolls, like a wheel's detents.
    let detent = Math.floor(scroll.get() / SCROLL_TICK_PX);
    const unsubscribe = scroll.on("change", (v) => {
      const now = Math.floor(v / SCROLL_TICK_PX);
      if (now !== detent) {
        detent = now;
        haptic("tick");
      }
    });
    void (async () => {
      await wait(SCROLL_START_MS);
      for (const item of items) {
        if (stopped) return;
        const key = item.date.slot.start;
        const row = rows.current.get(key)?.getBoundingClientRect();
        let circle = circleOf(item.day);
        if (row && circle) {
          const gap = circle.top + circle.height / 2 - (row.top + row.height / 2);
          if (gap > 1) {
            running = animate(scroll, scroll.get() + gap, {
              duration: Math.min(SCROLL_MAX_S, Math.max(SCROLL_MIN_S, gap / SCROLL_PX_PER_S)),
              ease: "easeInOut",
            });
            await running;
            if (stopped) return;
            circle = circleOf(item.day);
          }
        }
        setFlights((all) => ({
          ...all,
          [key]:
            row && circle
              ? {
                  x: circle.left - row.left,
                  y: circle.top - row.top,
                  scaleX: circle.width / row.width,
                  scaleY: circle.height / row.height,
                  circle: true,
                }
              : { x: 0, y: 24, scaleX: 1, scaleY: 1, circle: false },
        }));
        onTaken(item.day);
        haptic("answer");
        await wait(ARRIVAL_PAUSE_MS);
      }
      if (!stopped) onArrived();
    })();
    return () => {
      stopped = true;
      running?.stop();
      unsubscribe();
    };
    // Runs once, as the dates start to come out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "lifted", instant]);

  // The dates checked one after another, quicker and quicker (checkTimes);
  // each moves to its place the moment it is checked. Once the last has
  // settled the list is done.
  const [checked, setChecked] = useState(instant ? items.length : 0);
  useEffect(() => {
    if (!ranking || instant) return;
    const timers = checkTimes(items.length).map((at, i) =>
      window.setTimeout(() => {
        setChecked(i + 1);
        haptic("tick");
      }, at * 1000),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ranking, instant, items.length]);
  const allChecked = checked >= items.length;
  useEffect(() => {
    if (!ranking || !allChecked) return;
    const id = window.setTimeout(onRanked, PILE_TIMING.ranked * 1000);
    return () => window.clearTimeout(id);
  }, [ranking, allChecked, onRanked]);

  const order = useMemo(() => rankOrder(items.map((i) => i.facts)), [items]);
  const shown = liveOrder(
    order,
    checked,
    items.map((i) => i.chosen),
  ).map((i) => items[i]);

  return (
    <div className="flex flex-col gap-2">
      {/* One line that stays put while the dates are checked. */}
      <div className="flex min-h-9 items-center px-1">
        {done ? (
          <motion.h2
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-extrabold tracking-tight text-foreground"
          >
            {words.ranked(items.filter((i) => i.chosen).length)}
          </motion.h2>
        ) : (
          <p className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {words.reviewing}
          </p>
        )}
      </div>

      {shown.map((item) => {
        const key = item.date.slot.start;
        const at = items.indexOf(item);
        const rank = order.indexOf(at) + 1;
        const flight = flights?.[key];
        const status =
          at < checked
            ? item.chosen
              ? "yes"
              : "no"
            : ranking && at === checked
              ? "checking"
              : "waiting";
        const start = new Date(item.date.slot.start);
        const label = capitalize(dayLabel(start, lang));
        const isOpen = done && open === key;
        return (
          <motion.div
            // Mounted afresh once measured, so the flight starts from the circle.
            key={`${key}-${flight ? "in" : "waiting"}`}
            // Which rows the send flight moves, and which way (sendFlightPlay.ts).
            data-send-row={item.chosen ? "yes" : "no"}
            ref={(el) => {
              if (el) rows.current.set(key, el);
            }}
            // Slides to its place when checked (the others giving way), and
            // makes room when a row opens. The one just checked passes over
            // the rest.
            layout={ranking || done ? "position" : false}
            style={{
              transformOrigin: "0 0",
              zIndex: ranking && at === checked - 1 ? 10 : undefined,
            }}
            initial={
              flight && !instant
                ? {
                    x: flight.x,
                    y: flight.y,
                    scaleX: flight.scaleX,
                    scaleY: flight.scaleY,
                    opacity: flight.circle ? 1 : 0,
                  }
                : false
            }
            // Holds its place, unseen, until its date arrives.
            animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: flight || instant ? 1 : 0 }}
            transition={{
              duration: 0.55,
              delay: 0,
              ease: [0.3, 0.9, 0.3, 1],
              layout: { type: "spring", stiffness: 380, damping: 26 },
            }}
            className={cn(
              "glass relative overflow-hidden rounded-[22px]",
              // A lighter blur while the rows move, easing back once they're still.
              done ? "[transition:backdrop-filter_0.5s_ease-out]" : "glass-moving",
              status === "yes" && "ring-2 ring-emerald-500/70",
            )}
          >
            {/* The green of the circle it came out of, fading into glass. */}
            {flight?.circle && !instant && (
              <motion.div
                aria-hidden
                className="absolute inset-0 bg-emerald-500"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
              />
            )}
            <motion.button
              type="button"
              disabled={!done}
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              aria-label={words.details(label)}
              className="relative flex w-full items-center gap-3 px-4 py-3 text-left"
              initial={flight && !instant ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: instant ? 0 : 0.3, duration: 0.25 }}
            >
              {/* Its place: an empty ring until it is checked, so nothing shifts. */}
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                {at < checked ? (
                  <motion.span
                    key="rank"
                    initial={instant ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold",
                      item.chosen
                        ? "bg-emerald-500 text-white"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {rank}
                  </motion.span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/25" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-foreground">{label}</p>
                {meeting && (
                  <p className="text-[13px] text-muted-foreground">
                    {formatTime(item.date.slot.start)}-{formatTime(item.date.slot.end)}
                  </p>
                )}
                {/* Your own important event, found as the date is checked. */}
                {item.yours && at < checked && (
                  <motion.p
                    initial={instant ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-0.5 flex items-start gap-1 text-[12px] font-medium text-amber-800"
                  >
                    <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="line-clamp-2">{item.yours}</span>
                  </motion.p>
                )}
              </div>
              <StatusMark status={status} instant={instant} />
              {/* There from the start, so the marks never move; shown once a row can open. */}
              <ChevronDown
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-[transform,opacity] duration-300",
                  done ? "opacity-100" : "opacity-0",
                  isOpen && "rotate-180",
                )}
              />
            </motion.button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="relative overflow-hidden"
                >
                  <div className="space-y-1.5 border-t border-white/30 px-4 pb-3 pt-2.5 text-[14px]">
                    <p className="font-semibold text-foreground">
                      {formatEventDate(kind, item.date.slot, lang)}
                    </p>
                    {item.checks.map((c, ci) => (
                      <p
                        key={ci}
                        className={cn(
                          "flex items-start gap-2",
                          c.notable ? "text-amber-800" : "text-muted-foreground",
                        )}
                      >
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        {c.found}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/** A row's state: waiting its turn, being checked (a spinner), offered (a tick) or not (a cross). */
function StatusMark({
  status,
  instant,
}: {
  status: "waiting" | "checking" | "yes" | "no";
  instant: boolean;
}) {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {status === "checking" ? (
          <motion.span key="checking" exit={{ opacity: 0, scale: 0.6 }}>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </motion.span>
        ) : status === "yes" || status === "no" ? (
          <motion.span
            key={status}
            initial={instant ? false : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-white",
              status === "yes" ? "bg-emerald-500" : "bg-red-500",
            )}
          >
            {status === "yes" ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <X className="h-4 w-4" strokeWidth={3} />
            )}
          </motion.span>
        ) : (
          <span key="waiting" className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        )}
      </AnimatePresence>
    </span>
  );
}
