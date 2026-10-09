import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { Clock } from "lucide-react";

import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { formatSegmentRange, isoWeekNumber } from "@/lib/calendarOverview";
import { placeBlocks, placeSpan } from "@/lib/dayStrip";
import { formatTime } from "@/lib/format";
import { useIsDark } from "@/hooks/useIsDark";
import { shade, tint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * How the two sizes differ: hour height, the hour gutter, a line of a
 * block's name (the least a block is drawn as) and two lines (from which its
 * time shows too).
 */
const SIZES = {
  compact: { hourPx: 30, gutter: 30, linePx: 17, twoLinesPx: 32 },
  full: { hourPx: 46, gutter: 52, linePx: 22, twoLinesPx: 40 },
} as const;

/** How many days are in view at once. */
const IN_VIEW = 3;
/**
 * Days kept drawn either side of those in view while they can be swiped,
 * so a day slides in already drawn rather than appearing as it arrives.
 */
const DRAWN_BESIDE = 8;

/** How the days settle after a swipe or a tap on the week: Apple's quick, soft stop. */
const SETTLE = { type: "spring", damping: 38, stiffness: 380, mass: 0.8 } as const;

/**
 * Your calendar's days side by side, drawn like Apple Calendar's day view
 * (#74), so it reads as your real calendar rather than a summary of it: the
 * hours down the left with a line across at each, a header per day (today in
 * red), whole-day entries on top, each block in its calendar's colour with a
 * bar down its side and its name, the time now as Apple's red line, and the
 * suggested date pencilled in as a dashed block. Overlapping blocks sit side
 * by side or indented over each other as Apple draws them (placeBlocks).
 *
 * Every block shows its name: a short one is drawn a line tall at least, and
 * a name is `sticky`, so it stays in view while its block is scrolled
 * through (done by the browser, so fast scrolling can't leave it behind).
 * Calendar names stand where Apple has event titles: Casy stores no titles.
 *
 * The days are one continuous strip, three in view, `offset` days from
 * `home`. With `onOffset`, it follows a sideways drag and settles on whole
 * days, and slides to a new offset given from outside (the week row): the
 * header, the whole-day row and the blocks all move as one, clipped clear
 * of the hours. The day scrolls up and down, opening on the suggested time.
 */
export default function DayColumns({
  home,
  offset = 0,
  onOffset,
  slot,
  slotLabel,
  calendar,
  size,
  fitDay = false,
  corner,
}: {
  /** The suggested date's local midnight: offset 0 shows the day before, it, and the day after. */
  home: number;
  offset?: number;
  /** Swiping moves the days; this hears where they settle. */
  onOffset?: (offset: number) => void;
  /** The suggested date, pencilled in where it falls. */
  slot: { start: number; end: number };
  slotLabel: string;
  calendar: MyCalendarDays;
  size: keyof typeof SIZES;
  /**
   * The whole day, midnight to midnight, fitted into the height there is
   * rather than scrolled through: a computer has the room.
   */
  fitDay?: boolean;
  /** What sits in the corner above the hours; the week number if nothing. */
  corner?: ReactNode;
}) {
  // Calendar colours are worked out in code, so they follow the theme here.
  const dark = useIsDark();
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const { gutter, linePx, twoLinesPx } = SIZES[size];
  const scroller = useRef<HTMLDivElement>(null);
  // Fitting the day: each hour gets a 24th of the height there is, measured.
  const [fitHourPx, setFitHourPx] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!fitDay || !el) return;
    const measure = () => setFitHourPx(el.clientHeight / 24);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitDay]);
  const hourPx = fitDay ? fitHourPx : SIZES[size].hourPx;
  const dayPx = hourPx * 24;
  const compact = size === "compact";
  const viewport = useRef<HTMLDivElement>(null);

  // One column's width, measured, so the strip can be moved in pixels.
  const [columnPx, setColumnPx] = useState(0);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // offsetWidth, not the bounding box: the box is measured while it is
    // still scaled by the morph out of the strip, and a scale isn't a size.
    const measure = () => setColumnPx(el.offsetWidth / IN_VIEW);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Where the strip is: day k (from home) sits at (k + 1) columns, so
  // offset 0 shows days -1, 0 and 1.
  const x = useMotionValue(0);
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!columnPx) return;
    const target = -offset * columnPx;
    // The first placing, and a resize, jump; a new offset slides.
    if (!placed.current || reduceMotion) {
      x.set(target);
      placed.current = true;
    } else {
      animate(x, target, SETTLE);
    }
  }, [offset, columnPx, x, reduceMotion]);

  // Open on the suggested time, in the middle of the view; a date lasting
  // whole days (a trip, a holiday) opens on the morning instead.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || fitDay) return;
    const span = placeSpan(slot.start, slot.end, home, TZ);
    const target =
      span.height > 0.8 ? 8 * hourPx : (span.top + span.height / 2) * dayPx - el.clientHeight / 2;
    el.scrollTop = Math.max(0, target);
    // Only on opening, not on every day swiped to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The red line moves with the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = startOfDay(now, TZ);
  const nowTop = placeSpan(now, now + 1, today, TZ).top * dayPx;

  // The days drawn: those in view, and some either side to swipe into.
  const beside = onOffset ? DRAWN_BESIDE : 0;
  const drawn = Array.from({ length: IN_VIEW + 2 * beside }, (_, i) => offset - 1 - beside + i);
  const dayOf = (k: number) => addDays(home, k, TZ);
  const inView = [offset - 1, offset, offset + 1].map(dayOf);
  const showsToday = inView.includes(today);
  const allDay = new Map(
    drawn.map((k) => [k, calendar.segmentsOn(new Date(dayOf(k))).filter((s) => s.allDay)]),
  );
  // The whole-day row is there when a day in view has something for it, as
  // Apple's is, not for a day drawn out of sight.
  const anyAllDay = [offset - 1, offset, offset + 1].some((k) => allDay.get(k)!.length > 0);
  const columnStyle = (k: number) => ({ left: (k + 1) * columnPx, width: columnPx });

  // A sideways drag moves the strip under the finger, and settles on whole
  // days: as far as it was dragged, or a day on for a quick flick. Up and
  // down is left to the browser's own scrolling.
  const drag = useRef<{
    x0: number;
    y0: number;
    from: number;
    last: number;
    lastAt: number;
    speed: number;
    sideways: boolean | null;
  } | null>(null);
  const settle = (to: number) => {
    if (to === offset) animate(x, -offset * columnPx, SETTLE);
    else onOffset?.(to);
  };

  // A two-finger sideways swipe on a trackpad arrives as horizontal wheel
  // events: the days follow it, its momentum included, and settle on a
  // whole day once it stops. Listened to directly, not through React (whose
  // wheel listeners can't cancel), so the swipe is kept from the browser,
  // which would otherwise take it as "back a page".
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ columnPx, settle });
  useEffect(() => {
    latest.current = { columnPx, settle };
  });
  const swipeable = !!onOffset;
  useEffect(() => {
    const el = root.current;
    if (!el || !swipeable) return;
    let settleAfter: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!latest.current.columnPx) return;
      // A mouse's sideways wheel counts in lines; a trackpad's in pixels.
      const dx = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaX * 16 : e.deltaX;
      x.stop();
      x.set(x.get() - dx);
      clearTimeout(settleAfter);
      settleAfter = setTimeout(() => {
        const { columnPx: px, settle: settleOn } = latest.current;
        settleOn(Math.round(-x.get() / px));
      }, 120);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(settleAfter);
    };
  }, [swipeable, x]);
  const dragHandlers = onOffset && {
    onPointerDown: (e: PointerEvent) => {
      x.stop();
      drag.current = {
        x0: e.clientX,
        y0: e.clientY,
        from: x.get(),
        last: e.clientX,
        lastAt: e.timeStamp,
        speed: 0,
        sideways: null,
      };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (d.sideways === null && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
        d.sideways = Math.abs(dx) > Math.abs(dy);
        if (d.sideways) e.currentTarget.setPointerCapture(e.pointerId);
      }
      if (!d.sideways) return;
      x.set(d.from + dx);
      d.speed = (e.clientX - d.last) / Math.max(e.timeStamp - d.lastAt, 1);
      d.last = e.clientX;
      d.lastAt = e.timeStamp;
    },
    onPointerUp: () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.sideways || !columnPx) return;
      let to = Math.round(-x.get() / columnPx);
      if (to === offset && Math.abs(d.speed) > 0.35) to = offset + (d.speed < 0 ? 1 : -1);
      settle(to);
    },
    onPointerCancel: () => {
      const d = drag.current;
      drag.current = null;
      if (d?.sideways) settle(offset);
    },
  };

  /** "tirs. 6." on the strip, "tirs. 6. okt." on the whole screen. */
  const headerText = (midnight: number) => {
    const weekday = new Date(midnight).toLocaleDateString(LOCALE[lang], {
      weekday: "short",
      timeZone: TZ,
    });
    const month = new Date(midnight).toLocaleDateString(LOCALE[lang], {
      month: "short",
      timeZone: TZ,
    });
    const day = localDate(midnight, TZ).day;
    const sep = lang === "da" ? "." : "";
    return compact ? `${weekday} ${day}${sep}` : `${weekday} ${day}${sep} ${month}`;
  };

  return (
    <div
      ref={root}
      className="flex h-full min-h-0 flex-col"
      style={swipeable ? { overscrollBehaviorX: "contain" } : undefined}
    >
      {/* The days' names, with the week number in the corner as Apple has it. */}
      <div className={cn("flex shrink-0 items-center border-b", compact ? "h-7" : "h-11")}>
        <span
          className={cn(
            "flex shrink-0 justify-center text-muted-foreground",
            compact ? "text-[10px]" : "text-[15px]",
          )}
          style={{ width: gutter }}
        >
          {corner ?? t.swipe.week(isoWeekNumber(new Date(dayOf(offset)), TZ))}
        </span>
        <Track x={x} className="h-full">
          {drawn.map((k) => {
            const midnight = dayOf(k);
            const onSlot = slot.start < dayOf(k + 1) && slot.end > midnight;
            return (
              <p
                key={k}
                className={cn(
                  "absolute inset-y-0 flex items-center justify-center truncate font-semibold",
                  compact ? "text-[11px]" : "text-[15px]",
                  midnight === today ? "text-red-500" : onSlot ? "text-primary" : "text-foreground",
                )}
                style={columnStyle(k)}
              >
                {headerText(midnight)}
              </p>
            );
          })}
        </Track>
      </div>

      {anyAllDay && (
        <div className="flex shrink-0 border-b">
          <span className="shrink-0" style={{ width: gutter }} />
          <Track x={x} className={compact ? "h-[18px]" : "h-[26px]"}>
            {drawn.map((k) => (
              <div
                key={k}
                className="absolute inset-y-0 flex flex-col justify-center px-0.5"
                style={columnStyle(k)}
              >
                {allDay
                  .get(k)!
                  .slice(0, 1)
                  .map((s, j, list) => {
                    const rgb = calendar.colorOf(s.calendarId);
                    const more = allDay.get(k)!.length - list.length;
                    return (
                      <p
                        key={j}
                        className={cn(
                          "truncate rounded border-l-[3px] px-1 font-semibold",
                          compact ? "text-[9px] leading-[14px]" : "text-[12px] leading-5",
                        )}
                        style={{
                          background: `rgb(${tint(rgb, dark)})`,
                          borderColor: `rgb(${rgb})`,
                          color: `rgb(${shade(rgb, dark)})`,
                        }}
                      >
                        {calendar.labelOf(s)}
                        {more > 0 && ` +${more}`}
                      </p>
                    );
                  })}
              </div>
            ))}
          </Track>
        </div>
      )}

      <div
        ref={scroller}
        className={cn(
          "relative min-h-0 flex-1 overflow-x-hidden overscroll-contain",
          fitDay ? "overflow-y-hidden" : "overflow-y-auto",
        )}
      >
        <div className="relative" style={{ height: dayPx }}>
          {/* An hour line across, labelled in the gutter (not under the time now). */}
          {Array.from({ length: 25 }, (_, h) => (
            <div key={h} className="absolute inset-x-0" style={{ top: h * hourPx }}>
              {h > 0 &&
                h < 24 &&
                // Every other hour when the day is fitted into little height.
                h % (hourPx < 18 ? 2 : 1) === 0 &&
                !(showsToday && Math.abs(h * hourPx - nowTop) < 12) && (
                  <span
                    className={cn(
                      "absolute -translate-y-1/2 pr-1.5 text-right tabular-nums text-muted-foreground",
                      compact ? "text-[9px]" : "text-[12px]",
                    )}
                    style={{ width: gutter }}
                  >
                    {compact ? String(h).padStart(2, "0") : `${String(h).padStart(2, "0")}:00`}
                  </span>
                )}
              <div className="border-t border-border/80" style={{ marginLeft: gutter }} />
            </div>
          ))}

          {/* The days, clipped clear of the hours. `clip`, not `hidden`, so the
              names inside can still stick to the top of the scrolling day. */}
          <div
            ref={viewport}
            className="absolute inset-y-0 right-0 overflow-x-clip"
            style={{ left: gutter, touchAction: "pan-y" }}
            {...dragHandlers}
          >
            <motion.div className="absolute inset-y-0 left-0" style={{ x }}>
              {columnPx > 0 &&
                drawn.map((k) => {
                  const midnight = dayOf(k);
                  const blocks = placeBlocks(
                    calendar.segmentsOn(new Date(midnight)),
                    midnight,
                    TZ,
                    linePx / dayPx,
                  );
                  const slotSpan = placeSpan(slot.start, slot.end, midnight, TZ);
                  const slotPx = Math.max(slotSpan.height * dayPx, linePx);
                  return (
                    <div
                      key={k}
                      className="absolute inset-y-0 border-l border-border/60"
                      style={columnStyle(k)}
                    >
                      {calendar.loading && (
                        <div
                          aria-hidden
                          className="absolute inset-1 animate-pulse rounded bg-secondary"
                        />
                      )}
                      {blocks.map((b, i) => {
                        const rgb = calendar.colorOf(b.segment.calendarId);
                        const px = b.height * dayPx;
                        return (
                          <div
                            key={i}
                            className="absolute overflow-clip rounded-[5px] ring-1 ring-card"
                            style={{
                              top: b.top * dayPx + 1,
                              height: px - 2,
                              left: `calc(${b.left * 100}% + 2px)`,
                              width: `calc(${b.width * 100}% - 4px)`,
                              background: `rgb(${tint(rgb, dark)})`,
                            }}
                          >
                            <span
                              aria-hidden
                              className="absolute inset-y-0.5 left-0.5 w-[3px] rounded-full"
                              style={{ background: `rgb(${rgb})` }}
                            />
                            <div
                              className={cn("sticky top-0 pl-2 pr-1", compact ? "pt-px" : "pt-0.5")}
                              style={{ color: `rgb(${shade(rgb, dark)})` }}
                            >
                              <p
                                className={cn(
                                  "truncate font-semibold",
                                  compact
                                    ? "text-[10px] leading-[14px]"
                                    : "text-[13px] leading-[17px]",
                                )}
                              >
                                {calendar.labelOf(b.segment)}
                              </p>
                              {px >= twoLinesPx && (
                                <p
                                  className={cn(
                                    "flex items-center gap-0.5 truncate tabular-nums opacity-90",
                                    compact ? "text-[9px]" : "text-[12px]",
                                  )}
                                >
                                  <Clock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
                                  {formatSegmentRange(b.segment, TZ, t.calendarView.allDay)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* The suggested date: pencilled in, on top of what it runs into. */}
                      {slotSpan.height > 0 && (
                        <div
                          className="pointer-events-none absolute inset-x-0.5 z-10 overflow-clip rounded-[5px] border-2 border-dashed border-primary bg-primary/10 px-1.5"
                          style={{ top: slotSpan.top * dayPx, height: slotPx }}
                        >
                          <div className="sticky top-0">
                            <p
                              className={cn(
                                "truncate font-bold text-primary",
                                compact
                                  ? "text-[10px] leading-[14px]"
                                  : "text-[13px] leading-[18px]",
                              )}
                            >
                              {slotLabel}
                            </p>
                            {!compact && slotPx >= twoLinesPx && (
                              <p className="text-[12px] tabular-nums text-primary">
                                {formatTime(new Date(slot.start).toISOString())}-
                                {formatTime(new Date(slot.end).toISOString())}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {midnight === today && (
                        <div
                          aria-hidden
                          className="absolute inset-x-0 z-20 h-0.5 bg-red-500"
                          style={{ top: nowTop }}
                        />
                      )}
                    </div>
                  );
                })}
            </motion.div>
          </div>

          {/* The time now, as Apple marks it in the gutter. */}
          {showsToday && (
            <span
              aria-hidden
              className={cn(
                "absolute z-20 -translate-y-1/2 rounded-full bg-red-500 text-center font-semibold tabular-nums text-white",
                compact ? "left-1 h-2 w-2" : "left-0.5 px-1.5 py-0.5 text-[11px]",
              )}
              style={{ top: nowTop }}
            >
              {!compact && formatTime(new Date(now).toISOString())}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** A row's share of the day strip: clipped to its width, moved by the same `x` as the blocks. */
function Track({
  x,
  className,
  children,
}: {
  x: MotionValue<number>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative min-w-0 flex-1 overflow-hidden", className)}>
      <motion.div className="absolute inset-y-0 left-0" style={{ x }}>
        {children}
      </motion.div>
    </div>
  );
}
