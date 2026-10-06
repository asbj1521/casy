import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";

import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { formatSegmentRange, isoWeekNumber } from "@/lib/calendarOverview";
import { placeBlocks, placeSpan } from "@/lib/dayStrip";
import { formatTime } from "@/lib/format";
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

/** "r, g, b" darkened, for a block's words on its own tint, as Apple writes them. */
function shade(rgb: string, k = 0.72): string {
  return rgb
    .split(",")
    .map((c) => Math.round(Number(c) * k))
    .join(", ");
}

/**
 * "r, g, b" as a pale tint, solid rather than see-through, so a block
 * indented over another reads cleanly on top of it.
 */
function tint(rgb: string, amount = 0.16): string {
  return rgb
    .split(",")
    .map((c) => Math.round(255 - (255 - Number(c)) * amount))
    .join(", ");
}

/** How far a sideways swipe must go (px) to move a day. */
const SWIPE_AT = 50;

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
 * a name slides down to stay in view while its block is scrolled through.
 * Calendar names stand where Apple has event titles: Casy stores no titles.
 *
 * The day scrolls, and opens on the suggested time. `compact` is the strip
 * under a swipe card, `full` the calendar it opens into (CalendarSheet),
 * which also turns a sideways swipe into `onSwipe`.
 */
export default function DayColumns({
  days,
  slot,
  slotLabel,
  calendar,
  size,
  corner,
  direction = 0,
  onSwipe,
}: {
  /** Each column's local midnight. */
  days: number[];
  /** The suggested date, pencilled in where it falls. */
  slot: { start: number; end: number };
  slotLabel: string;
  calendar: MyCalendarDays;
  size: keyof typeof SIZES;
  /** What sits in the corner above the hours; the week number if nothing. */
  corner?: ReactNode;
  /** Which way the days just moved (-1 back, 1 on), for the slide. */
  direction?: number;
  onSwipe?: (dir: -1 | 1) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const { hourPx, gutter, linePx, twoLinesPx } = SIZES[size];
  const dayPx = hourPx * 24;
  const compact = size === "compact";
  const scroller = useRef<HTMLDivElement>(null);
  // How far the day is scrolled, so names can stay in view (see Block).
  const [scrollTop, setScrollTop] = useState(0);

  // Open on the suggested time, in the middle of the view; a date lasting
  // whole days (a trip, a holiday) opens on the morning instead.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const span = placeSpan(slot.start, slot.end, startOfDay(slot.start, TZ), TZ);
    const target =
      span.height > 0.8 ? 8 * hourPx : (span.top + span.height / 2) * dayPx - el.clientHeight / 2;
    el.scrollTop = Math.max(0, target);
    setScrollTop(el.scrollTop);
    // Only on opening, not on every day stepped to.
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
  const showsToday = days.includes(today);

  const allDay = days.map((d) => calendar.segmentsOn(new Date(d)).filter((s) => s.allDay));
  const anyAllDay = allDay.some((list) => list.length > 0);

  // A sideways swipe moves the days; up and down is left to the scroll.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipeHandlers = onSwipe && {
    onPointerDown: (e: PointerEvent) => {
      swipe.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const from = swipe.current;
      swipe.current = null;
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (Math.abs(dx) > SWIPE_AT && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => {
      swipe.current = null;
    },
  };
  const slide = {
    initial: direction ? { x: direction * 48, opacity: 0 } : false,
    animate: { x: 0, opacity: 1 },
    transition: { duration: 0.22, ease: "easeOut" },
  } as const;
  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  /** "tirs. 6." on the strip, "tirs. 6. okt." on the whole screen. */
  const header = (midnight: number) => {
    const weekday = new Date(midnight).toLocaleDateString(LOCALE[lang], {
      weekday: "short",
      timeZone: TZ,
    });
    const month = new Date(midnight).toLocaleDateString(LOCALE[lang], {
      month: "short",
      timeZone: TZ,
    });
    const day = localDate(midnight, TZ).day;
    const text =
      lang === "da"
        ? `${weekday} ${day}.${compact ? "" : ` ${month}`}`
        : `${weekday} ${day}${compact ? "" : ` ${month}`}`;
    const onSlot = slot.start < addDays(midnight, 1, TZ) && slot.end > midnight;
    return (
      <p
        key={midnight}
        className={cn(
          "truncate text-center font-semibold",
          compact ? "text-[11px]" : "text-[15px]",
          midnight === today ? "text-red-500" : onSlot ? "text-primary" : "text-foreground",
        )}
      >
        {text}
      </p>
    );
  };

  /** A name kept in view: pushed down by as much of its block as is scrolled past. */
  const keepInView = (topPx: number, heightPx: number, labelPx: number) =>
    Math.min(Math.max(scrollTop - topPx, 0), Math.max(heightPx - labelPx, 0));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The days' names, with the week number in the corner as Apple has it. */}
      <div className={cn("flex shrink-0 items-center border-b", compact ? "h-7" : "h-11")}>
        <span
          className={cn(
            "flex shrink-0 justify-center text-muted-foreground",
            compact ? "text-[10px]" : "text-[15px]",
          )}
          style={{ width: gutter }}
        >
          {corner ?? t.swipe.week(isoWeekNumber(new Date(days[1] ?? days[0]), TZ))}
        </span>
        <motion.div key={days[0]} {...slide} className="grid min-w-0 flex-1" style={columns}>
          {days.map(header)}
        </motion.div>
      </div>

      {anyAllDay && (
        <div className="flex shrink-0 border-b py-1">
          <span className="shrink-0" style={{ width: gutter }} />
          <div className="grid min-w-0 flex-1 gap-1 px-0.5" style={columns}>
            {allDay.map((list, i) => (
              <div key={days[i]} className="flex min-w-0 flex-col gap-0.5">
                {list.slice(0, compact ? 1 : 3).map((s, j) => {
                  const rgb = calendar.colorOf(s.calendarId);
                  return (
                    <p
                      key={j}
                      className={cn(
                        "truncate rounded border-l-[3px] px-1 font-semibold",
                        compact ? "text-[9px] leading-[14px]" : "text-[12px] leading-5",
                      )}
                      style={{
                        background: `rgb(${tint(rgb)})`,
                        borderColor: `rgb(${rgb})`,
                        color: `rgb(${shade(rgb)})`,
                      }}
                    >
                      {calendar.labelOf(s)}
                      {compact && list.length > 1 && ` +${list.length - 1}`}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={scroller}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{ touchAction: "pan-y" }}
        {...swipeHandlers}
      >
        <div className="relative" style={{ height: dayPx }}>
          {/* An hour line across, labelled in the gutter (not under the time now). */}
          {Array.from({ length: 25 }, (_, h) => (
            <div key={h} className="absolute inset-x-0" style={{ top: h * hourPx }}>
              {h > 0 && h < 24 && !(showsToday && Math.abs(h * hourPx - nowTop) < 12) && (
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

          <motion.div
            key={days[0]}
            {...slide}
            className="absolute inset-y-0 right-0 grid"
            style={{ left: gutter, ...columns }}
          >
            {days.map((midnight) => {
              const blocks = placeBlocks(
                calendar.segmentsOn(new Date(midnight)),
                midnight,
                TZ,
                linePx / dayPx,
              );
              const slotSpan = placeSpan(slot.start, slot.end, midnight, TZ);
              const slotTop = slotSpan.top * dayPx;
              const slotPx = Math.max(slotSpan.height * dayPx, linePx);
              return (
                <div key={midnight} className="relative border-l border-border/60">
                  {calendar.loading && (
                    <div
                      aria-hidden
                      className="absolute inset-1 animate-pulse rounded bg-secondary"
                    />
                  )}
                  {blocks.map((b, i) => {
                    const rgb = calendar.colorOf(b.segment.calendarId);
                    const topPx = b.top * dayPx;
                    const px = b.height * dayPx;
                    const twoLines = px >= twoLinesPx;
                    return (
                      <div
                        key={i}
                        className="absolute overflow-hidden rounded-[5px] ring-1 ring-card"
                        style={{
                          top: topPx + 1,
                          height: px - 2,
                          left: `calc(${b.left * 100}% + 2px)`,
                          width: `calc(${b.width * 100}% - 4px)`,
                          background: `rgb(${tint(rgb)})`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0.5 left-0.5 w-[3px] rounded-full"
                          style={{ background: `rgb(${rgb})` }}
                        />
                        <div
                          className={cn("pl-2 pr-1", compact ? "pt-px" : "pt-0.5")}
                          style={{
                            color: `rgb(${shade(rgb)})`,
                            transform: `translateY(${keepInView(topPx, px, twoLines ? twoLinesPx : linePx)}px)`,
                          }}
                        >
                          <p
                            className={cn(
                              "truncate font-semibold",
                              compact ? "text-[10px] leading-[14px]" : "text-[13px] leading-[17px]",
                            )}
                          >
                            {calendar.labelOf(b.segment)}
                          </p>
                          {twoLines && (
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
                      className="pointer-events-none absolute inset-x-0.5 z-10 overflow-hidden rounded-[5px] border-2 border-dashed border-primary bg-primary/10 px-1.5"
                      style={{ top: slotTop, height: slotPx }}
                    >
                      <div
                        style={{
                          transform: `translateY(${keepInView(slotTop, slotPx, compact ? linePx : twoLinesPx)}px)`,
                        }}
                      >
                        <p
                          className={cn(
                            "truncate font-bold text-primary",
                            compact ? "text-[10px] leading-[14px]" : "text-[13px] leading-[18px]",
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
