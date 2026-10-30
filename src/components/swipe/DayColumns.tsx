import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { Clock } from "lucide-react";

import type { EventResponse } from "@/api/events";
import { STAMP_TONE } from "@/components/swipe/stampTone";
import { TODAY_TONE, type TodayTone } from "@/components/swipe/todayTone";
import { AnswerIcon } from "@/components/swipe/SwipeCard";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useLang, useT } from "@/i18n/lang";
import { formatSegmentRange, isoWeekNumber, type DaySegment } from "@/lib/calendarOverview";
import { columnOf, daysInView, drawnDays, openingOf, type DayLead } from "@/lib/dayColumns";
import { TRAVEL_EASE, travelBlur, travelMs } from "@/lib/dayTravel";
import { placeBlocks, placeSpan } from "@/lib/dayStrip";
import { formatTime, monthShortName, weekdayName, weekdayShortName } from "@/lib/format";
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

/** Whole-day rows the full size stacks under the day names, a row's height with its gap. */
const ALL_DAY_ROWS = 3;
const ALL_DAY_ROW_PX = 24;

/**
 * Days kept drawn either side of those in view while they can be swiped,
 * so a day slides in already drawn rather than appearing as it arrives.
 */
const DRAWN_BESIDE = 8;

/** How the days settle after a swipe or a tap on the week: Apple's quick, soft stop. */
const SETTLE = { type: "spring", damping: 38, stiffness: 380, mass: 0.8 } as const;

/** A date pencilled in as a dashed block: a suggested date, or a vote's date to answer. */
export interface Pencil {
  key: string;
  start: number;
  end: number;
  label: string;
  /** The date being answered: drawn solid. */
  lit?: boolean;
  /** Your answer to it, stamped in its corner. */
  stamp?: EventResponse;
  onTap?: () => void;
}

const NO_PENCILS: readonly Pencil[] = [];

/** What a glide blurs: the clipped rows of days, never the hours beside them. */
const BLURRED = { filter: "var(--day-blur, none)" } as const;

/** How long the vote's card is given to finish growing before the date is centred above it. */
const CLEAR_SETTLE_MS = 120;

/** Days apart beyond which a glide draws only its two ends, not every day between. */
const DRAWN_BETWEEN = 24;

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
 * The days are one continuous strip, `days` in view (three, the day in
 * the middle, on the swipe screen; one or two, the day first, on the home
 * page's day view, #176), `offset` days from `home` (lib/dayColumns). With `onOffset`, it follows a sideways drag and settles on whole
 * days, and slides to a new offset given from outside (the week row): the
 * header, the whole-day row and the blocks all move as one, clipped clear
 * of the hours. The day scrolls up and down, opening on the suggested time
 * (`aim`), or without one on the time now, the first event or 08:00.
 */
export default function DayColumns({
  home,
  offset = 0,
  onOffset,
  days = 3,
  lead = "middle",
  aim,
  pencils = NO_PENCILS,
  onBlockTap,
  travel = false,
  clear = 0,
  tone = "red",
  calendar,
  size,
  fitDay = false,
  fitHours,
  corner,
  focus,
}: {
  /** The day it is about, a local midnight: offset 0 shows it as `lead` puts it. */
  home: number;
  offset?: number;
  /** Swiping moves the days; this hears where they settle. */
  onOffset?: (offset: number) => void;
  /** How many days are in view at once. */
  days?: 1 | 2 | 3;
  /** Where the day it is about sits among them: the middle of three, or first. */
  lead?: DayLead;
  /** The time it opens on, in the middle of the view: the suggested date. */
  aim?: { start: number; end: number };
  /** Dates pencilled in where they fall, dashed. */
  pencils?: readonly Pencil[];
  /** A tap on one of your events, timed or whole-day. */
  onBlockTap?: (segment: DaySegment) => void;
  /**
   * A new offset given from outside (the next of a vote's dates, #176)
   * glides there fast and stops softly, blurred sideways with the speed
   * (lib/dayTravel); a new `aim` is scrolled to as it goes. A swipe keeps
   * its own settle.
   */
  travel?: boolean;
  /** Pixels covered along the bottom (a vote's card): what is aimed at is centred above them. */
  clear?: number;
  /** Today's colour (its header, the now-line): Apple's red, or Casy's orange. */
  tone?: TodayTone;
  calendar: MyCalendarDays;
  size: keyof typeof SIZES;
  /**
   * The whole day, midnight to midnight, fitted into the height there is
   * rather than scrolled through: a computer has the room.
   */
  fitDay?: boolean;
  /**
   * So many hours fitted into the height there is, and scrolled to what is
   * aimed at: an agreed event's slice (#177), whose length decides it.
   */
  fitHours?: number;
  /** What sits in the corner above the hours; the week number if nothing. */
  corner?: ReactNode;
  /**
   * One of your events to show (a warning's "Vis mig", #114): scrolled to,
   * smoothly, and ringed. Its day is brought into view by `offset`. Given at
   * all (even null), the days either side are drawn, so moving there slides.
   */
  focus?: { start: number; end: number } | null;
}) {
  // Calendar colours are worked out in code, so they follow the theme here.
  const dark = useIsDark();
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const { gutter, linePx, twoLinesPx } = SIZES[size];
  const scroller = useRef<HTMLDivElement>(null);
  // Fitting the day (or `fitHours` of it): each hour gets its share of the
  // height there is, measured.
  const fitted = fitDay ? 24 : fitHours;
  const [fitHourPx, setFitHourPx] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!fitted || !el) return;
    const measure = () => setFitHourPx(el.clientHeight / fitted);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitted]);
  const hourPx = fitted ? fitHourPx : SIZES[size].hourPx;
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
    const measure = () => setColumnPx(el.offsetWidth / days);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [days]);

  // The sideways blur of a glide: an SVG filter blurring along x only,
  // switched on (`--day-blur`) only while the days move fast.
  const root = useRef<HTMLDivElement>(null);
  const blurId = `day-blur-${useId().replace(/[^\w-]/g, "")}`;
  const blurNode = useRef<SVGFEGaussianBlurElement>(null);
  const blurTo = (px: number) => {
    root.current?.style.setProperty("--day-blur", px > 0.3 ? `url(#${blurId})` : "none");
    blurNode.current?.setAttribute("stdDeviation", `${px.toFixed(1)} 0`);
  };

  // The offset the strip last rested on, so a glide keeps drawing the days
  // it leaves (React's pattern for state following a prop).
  const [rest, setRest] = useState({ offset, from: offset });
  if (rest.offset !== offset) setRest({ offset, from: rest.offset });
  const rested = () => setRest((r) => ({ ...r, from: r.offset }));

  // Where the strip is: day k (from home) sits at columnOf(k) columns, and
  // the strip is moved back by `offset` columns (lib/dayColumns).
  const x = useMotionValue(0);
  const placed = useRef(false);
  // A new offset from a swipe settling is the finger's; any other was given.
  const swiped = useRef(false);
  useLayoutEffect(() => {
    if (!columnPx) return;
    const target = -offset * columnPx;
    const bySwipe = swiped.current;
    swiped.current = false;
    // The first placing, and a resize, jump; a new offset slides.
    if (!placed.current || reduceMotion) {
      x.set(target);
      placed.current = true;
      return;
    }
    if (travel && !bySwipe) {
      const glide = animate(x, target, {
        duration: travelMs(Math.round(Math.abs(target - x.get()) / columnPx)) / 1000,
        ease: [...TRAVEL_EASE],
        onUpdate: () => blurTo(travelBlur(x.getVelocity())),
        onComplete: () => {
          blurTo(0);
          rested();
        },
      });
      return () => {
        glide.stop();
        blurTo(0);
      };
    }
    animate(x, target, { ...SETTLE, onComplete: rested });
    // blurTo and rested only touch refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, columnPx, x, reduceMotion, travel]);

  // Open on the suggested time, in the middle of the view; a date lasting
  // whole days (a trip, a holiday) opens on the morning instead. Without
  // one: today on the time now, another day just before its first event.
  // Once the hours have a height (measured first when they are fitted).
  const opened = useRef(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || fitDay || hourPx === 0 || opened.current) return;
    opened.current = true;
    let target: number;
    const shownDays = daysInView(offset, days, lead).map((k) => addDays(home, k, TZ));
    // Aimed at only when it is on a day in view (a vote's date, not the day
    // looked at meanwhile).
    if (aim && shownDays.includes(startOfDay(aim.start, TZ))) {
      const span = placeSpan(aim.start, aim.end, startOfDay(aim.start, TZ), TZ);
      target =
        span.height > 0.8
          ? 8 * hourPx
          : (span.top + span.height / 2) * dayPx - (el.clientHeight - clear) / 2;
    } else {
      const at = Date.now();
      const firsts = shownDays.flatMap((midnight) =>
        calendar
          .segmentsOn(new Date(midnight))
          .filter((s) => !s.allDay)
          .map((s) => placeSpan(s.start.getTime(), s.end.getTime(), midnight, TZ).top),
      );
      const opening = openingOf({
        now: shownDays.includes(startOfDay(at, TZ))
          ? placeSpan(at, at + 1, startOfDay(at, TZ), TZ).top
          : null,
        firstEvent: firsts.length > 0 ? Math.min(...firsts) : null,
      });
      target =
        "middle" in opening ? opening.middle * dayPx - el.clientHeight / 2 : opening.top * dayPx;
    }
    el.scrollTop = Math.max(0, target);
    // Only on opening, not on every day swiped to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourPx]);

  // Shown an event (a warning's "Vis mig"): its time, in the middle of the
  // view, scrolled to smoothly; shown none again, back to the suggested time.
  // Not on opening (the effect above), and not when the whole day fits.
  const focusStart = focus?.start ?? null;
  const focusEnd = focus?.end ?? null;
  const focused = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || fitDay) return;
    if (focusStart === null && !focused.current) return;
    focused.current = focusStart !== null;
    const back = focusStart === null || focusEnd === null;
    if (back && !aim) return;
    const span = back
      ? placeSpan(aim!.start, aim!.end, home, TZ)
      : placeSpan(focusStart, focusEnd, startOfDay(focusStart, TZ), TZ);
    const target =
      span.height > 0.8 ? 8 * hourPx : (span.top + span.height / 2) * dayPx - el.clientHeight / 2;
    el.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });
    // Only when what is shown changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusStart, focusEnd]);

  // A new date aimed at (a vote's next date, or its first when the vote
  // opens over a day already open), or its day back in view (the vote's
  // card unfolded after looking at other days): its time scrolled to the
  // middle of what the card leaves in view, as the days glide to it. Not
  // what it opened on, which the opening placed.
  const aimStart = aim?.start ?? null;
  const aimEnd = aim?.end ?? null;
  const aimInView =
    aimStart !== null &&
    daysInView(offset, days, lead).some((k) => addDays(home, k, TZ) === startOfDay(aimStart, TZ));
  const aimed = `${aimStart}/${aimInView}`;
  const lastAim = useRef(aimed);
  useEffect(() => {
    const el = scroller.current;
    if (aimed === lastAim.current) return;
    lastAim.current = aimed;
    if (!el || fitDay || !aimInView || aimStart === null || aimEnd === null) return;
    const span = placeSpan(aimStart, aimEnd, startOfDay(aimStart, TZ), TZ);
    const target =
      span.height > 0.8
        ? 8 * hourPx
        : (span.top + span.height / 2) * dayPx - (el.clientHeight - clear) / 2;
    el.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });
    // Only when what is aimed at, or whether its day is in view, changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimed]);
  // The card growing back (unfolded) covers more: once it has settled, the
  // date is put back in the middle of what is left. Not as it folds away,
  // which leaves you where you were looking.
  const lastClear = useRef(clear);
  useEffect(() => {
    const grew = clear > lastClear.current;
    lastClear.current = clear;
    const el = scroller.current;
    if (!grew || !el || fitDay || !aimInView || aimStart === null || aimEnd === null) return;
    const id = window.setTimeout(() => {
      const span = placeSpan(aimStart, aimEnd, startOfDay(aimStart, TZ), TZ);
      if (span.height > 0.8) return;
      const target = (span.top + span.height / 2) * dayPx - (el.clientHeight - clear) / 2;
      el.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });
    }, CLEAR_SETTLE_MS);
    return () => window.clearTimeout(id);
    // Only as the card's height changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clear]);

  // The red line moves with the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = startOfDay(now, TZ);
  const nowTop = placeSpan(now, now + 1, today, TZ).top * dayPx;

  // The days drawn: those in view, and some either side to swipe into.
  const beside = onOffset || focus !== undefined ? DRAWN_BESIDE : 0;
  // During a glide the days it leaves stay drawn too, and those between
  // unless they are many (the blur hides that they are blank).
  const from = rest.from;
  const drawn =
    from === offset
      ? drawnDays(offset, days, lead, beside)
      : [
          ...new Set([
            ...drawnDays(from, days, lead, beside),
            ...(Math.abs(offset - from) <= DRAWN_BETWEEN
              ? Array.from(
                  { length: Math.abs(offset - from) + 1 },
                  (_, i) => Math.min(from, offset) + i,
                )
              : []),
            ...drawnDays(offset, days, lead, beside),
          ]),
        ];
  const dayOf = (k: number) => addDays(home, k, TZ);
  const inViewK = daysInView(offset, days, lead);
  const inView = inViewK.map(dayOf);
  const showsToday = inView.includes(today);
  const allDay = new Map(
    drawn.map((k) => [k, calendar.segmentsOn(new Date(dayOf(k))).filter((s) => s.allDay)]),
  );
  // The whole-day row is there when a day in view has something for it, as
  // Apple's is, not for a day drawn out of sight.
  const anyAllDay = inViewK.some((k) => allDay.get(k)!.length > 0);
  // The days drawn out of sight are left out for screen readers.
  const hiddenUnless = (k: number) => (inViewK.includes(k) ? undefined : true);
  const columnStyle = (k: number) => ({
    left: columnOf(k, days, lead) * columnPx,
    width: columnPx,
  });
  // The full size stacks a day's whole-day entries, one row each, so none is
  // hidden behind another; past ALL_DAY_ROWS the last row counts the rest. The
  // strip has room for one, the rest counted on its label.
  const allDayRows = (n: number) => Math.min(n, compact ? 1 : ALL_DAY_ROWS);
  const allDayHeight = compact
    ? 18
    : Math.max(...inViewK.map((k) => allDayRows(allDay.get(k)!.length)), 1) * ALL_DAY_ROW_PX + 2;
  const pencilOn = (midnight: number) =>
    pencils.some((p) => p.start < addDays(midnight, 1, TZ) && p.end > midnight);

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
  // The click a sideways drag ends with isn't a tap on a block.
  const dragged = useRef(false);
  const tapped = (run: () => void) => () => {
    if (!dragged.current) run();
  };
  const settle = (to: number) => {
    if (to === offset) {
      animate(x, -offset * columnPx, SETTLE);
      return;
    }
    swiped.current = true;
    onOffset?.(to);
  };

  // A two-finger sideways swipe on a trackpad arrives as horizontal wheel
  // events: the days follow it, its momentum included, and settle on a
  // whole day once it stops. Listened to directly, not through React (whose
  // wheel listeners can't cancel), so the swipe is kept from the browser,
  // which would otherwise take it as "back a page".
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
      dragged.current = false;
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
        if (d.sideways) {
          dragged.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
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

  /** "tirs. 6." on the strip, "tirs. 6. okt." on the whole screen, "tirsdag 6. okt. 2026" alone. */
  const headerText = (midnight: number) => {
    const weekday = weekdayShortName(midnight, lang);
    const month = monthShortName(midnight, lang);
    const { day, year } = localDate(midnight, TZ);
    const sep = lang === "da" ? "." : "";
    if (compact) return `${weekday} ${day}${sep}`;
    if (days === 1) return `${weekdayName(midnight, lang)} ${day}${sep} ${month} ${year}`;
    return `${weekday} ${day}${sep} ${month}`;
  };

  return (
    <div
      ref={root}
      className="flex h-full min-h-0 flex-col"
      style={swipeable ? { overscrollBehaviorX: "contain" } : undefined}
    >
      {travel && (
        <svg aria-hidden className="absolute h-0 w-0">
          <filter id={blurId} x="-5%" width="110%">
            <feGaussianBlur ref={blurNode} stdDeviation="0 0" />
          </filter>
        </svg>
      )}
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
        <Track x={x} className="h-full" blurred={travel}>
          {drawn.map((k) => {
            const midnight = dayOf(k);
            const onSlot = pencilOn(midnight);
            return (
              <p
                key={k}
                aria-hidden={hiddenUnless(k)}
                className={cn(
                  "absolute inset-y-0 flex items-center justify-center truncate font-semibold",
                  compact ? "text-[11px]" : "text-[15px]",
                  // Alone, the day's name is plain, as Apple writes it; side by side, today is red.
                  midnight === today && days > 1
                    ? TODAY_TONE[tone].text
                    : onSlot
                      ? "text-primary"
                      : "text-foreground",
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
          <Track x={x} height={allDayHeight} blurred={travel}>
            {drawn.map((k) => {
              const list = allDay.get(k)!;
              // Past the rows there are, the last one is the count of the rest.
              const full = !compact && list.length > ALL_DAY_ROWS;
              const shown = list.slice(0, full ? ALL_DAY_ROWS - 1 : allDayRows(list.length));
              const more = list.length - shown.length;
              return (
                <div
                  key={k}
                  aria-hidden={hiddenUnless(k)}
                  className="absolute inset-y-0 flex flex-col justify-start gap-1 px-0.5 pt-px"
                  style={columnStyle(k)}
                >
                  {shown.map((s, j) => {
                    const rgb = calendar.colorOf(s.calendarId);
                    return (
                      <p
                        key={j}
                        {...(onBlockTap && {
                          role: "button",
                          onClick: tapped(() => onBlockTap(s)),
                        })}
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
                        {compact && more > 0 && ` +${more}`}
                      </p>
                    );
                  })}
                  {full && (
                    <p className="truncate rounded bg-muted px-1 text-[12px] font-semibold leading-5 text-muted-foreground">
                      +{more}
                    </p>
                  )}
                </div>
              );
            })}
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
            style={{ left: gutter, touchAction: "pan-y", ...(travel && BLURRED) }}
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
                  return (
                    <div
                      key={k}
                      aria-hidden={hiddenUnless(k)}
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
                        const ringed =
                          focusStart !== null &&
                          focusEnd !== null &&
                          b.segment.start.getTime() < focusEnd &&
                          b.segment.end.getTime() > focusStart;
                        return (
                          <div
                            key={i}
                            {...(onBlockTap && {
                              role: "button",
                              onClick: tapped(() => onBlockTap(b.segment)),
                            })}
                            className={cn(
                              "absolute overflow-clip rounded-[5px] transition-shadow",
                              ringed ? "z-[5] ring-2 ring-red-500" : "ring-1 ring-card",
                            )}
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
                      {pencils.map((p) => {
                        const span = placeSpan(p.start, p.end, midnight, TZ);
                        if (span.height <= 0) return null;
                        const px = Math.max(span.height * dayPx, linePx);
                        return (
                          <div
                            key={p.key}
                            {...(p.onTap && { role: "button", onClick: tapped(p.onTap) })}
                            className={cn(
                              "absolute inset-x-0.5 z-10 overflow-clip rounded-[5px] border-2 border-primary px-1.5",
                              p.lit ? "bg-primary/20" : "border-dashed bg-primary/10",
                              !p.onTap && "pointer-events-none",
                            )}
                            style={{ top: span.top * dayPx, height: px }}
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
                                {p.label}
                              </p>
                              {!compact && px >= twoLinesPx && (
                                <p className="text-[12px] tabular-nums text-primary">
                                  {formatTime(new Date(p.start).toISOString())}-
                                  {formatTime(new Date(p.end).toISOString())}
                                </p>
                              )}
                            </div>
                            {p.stamp && (
                              <span
                                key={p.stamp}
                                aria-hidden
                                className={cn(
                                  "animate-stamp absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white",
                                  STAMP_TONE[p.stamp],
                                )}
                              >
                                <AnswerIcon answer={p.stamp} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {midnight === today && (
                        <div
                          aria-hidden
                          className={cn("absolute inset-x-0 z-20 h-0.5", TODAY_TONE[tone].fill)}
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
                "absolute z-20 -translate-y-1/2 rounded-full text-center font-semibold tabular-nums text-white",
                TODAY_TONE[tone].fill,
                compact ? "left-1 h-2 w-2" : "left-0.5 px-1.5 py-0.5 text-[11px]",
              )}
              style={{ top: nowTop }}
            >
              {!compact && formatTime(new Date(now).toISOString())}
            </span>
          )}
        </div>
        {/* Room under the day, so the evening can be scrolled up above a card covering the bottom. */}
        {clear > 0 && <div aria-hidden style={{ height: clear }} />}
      </div>
    </div>
  );
}

/** A row's share of the day strip: clipped to its width, moved by the same `x` as the blocks. */
function Track({
  x,
  className,
  height,
  blurred = false,
  children,
}: {
  x: MotionValue<number>;
  className?: string;
  height?: number;
  /** Takes the glide's blur (`travel`). */
  blurred?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("relative min-w-0 flex-1 overflow-hidden", className)}
      style={{ ...(blurred ? BLURRED : undefined), ...(height !== undefined && { height }) }}
    >
      <motion.div className="absolute inset-y-0 left-0" style={{ x }}>
        {children}
      </motion.div>
    </div>
  );
}
