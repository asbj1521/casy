import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

import { DayRow } from "@/components/calendarView/DayRow";
import DayColumns, { type Pencil } from "@/components/swipe/DayColumns";
import { ZOOM } from "@/components/swipe/morph";
import WeekStrip from "@/components/swipe/WeekStrip";
import BottomSheet from "@/components/ui/BottomSheet";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useLang, useT } from "@/i18n/lang";
import type { DaySegment, OverviewCalendar } from "@/lib/calendarOverview";
import { daysBetween, mondayOf } from "@/lib/dayColumns";
import { capitalize, dayLabel } from "@/lib/format";
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

const FULL: Keyframe = {
  transform: "translate(0px, 0px) scale(1)",
  clipPath: "inset(0px 0px 0px 0px round 0px)",
  opacity: 1,
};

/**
 * A day of the home page's month, opened as Apple Calendar's day view
 * (#176): the week row (WeekStrip), then the hours (DayColumns) with the
 * day first, one day or the day and the next (`span`). Its buttons are the
 * home page's own toolbar (HomeToolbar, #180), which stays in place over it
 * and morphs, so it leaves `room` for them at its top; on the website it
 * starts under the page's header (`top`), so they never move.
 * The day shown is the page's address (`day`, `onDay`): a swipe, the week
 * row and "I dag" change it, the way back stays one step.
 *
 * It zooms out of the day's cell on the month and back into the cell of the
 * day it is on as it closes (`cellOf`, which brings that cell into view
 * first): the whole view scaled evenly down to the cell's width and clipped
 * to its height, as the swipe screen's calendar grows from its strip
 * (morph.ts). Without a cell in sight it fades. A tap on one of your events
 * opens its details in a sheet; a tap on one of Casy's opens what it is
 * (`actionOf`).
 */
export default function DayView({
  open,
  day,
  calendar,
  calendarById,
  pencils,
  actionOf,
  cellOf,
  onDay,
  onClosed,
  span,
  top,
  room,
  travel = false,
  aim,
  clear = 0,
  onTouchDays,
  children,
}: {
  /** False plays the zoom back into the month, then `onClosed`. */
  open: boolean;
  /** The first day in view, a local midnight. */
  day: number;
  calendar: MyCalendarDays;
  calendarById: ReadonlyMap<string, OverviewCalendar>;
  pencils: readonly Pencil[];
  actionOf: (segment: DaySegment) => (() => void) | undefined;
  /** A day's cell on the month, on screen; `bring` scrolls it into view first. */
  cellOf: (day: number, bring: boolean) => DOMRect | null;
  onDay: (day: number) => void;
  onClosed: () => void;
  /** One day in view or two (useDaySpan). */
  span: 1 | 2;
  /** Where it starts from the screen's top: under the website's header, else 0. */
  top: number;
  /** The room left at its top for the toolbar over it. */
  room: number;
  /**
   * A vote is answered over it (#176): a new day glides there fast,
   * blurred, to the date `aim`ed at, centred above the card's `clear`
   * pixels.
   */
  travel?: boolean;
  aim?: { start: number; end: number };
  clear?: number;
  /** A finger on the week row or the hours (a vote's card folds away). */
  onTouchDays?: () => void;
  children?: ReactNode;
}) {
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  // The strip of days counts from the day it opened on.
  const [home] = useState(day);
  const [today] = useState(() => startOfDay(Date.now(), TZ));
  // Which way the week row last turned, followed as the day changes.
  const [shown, setShown] = useState({ day, turn: 0 });
  if (shown.day !== day) {
    setShown({ day, turn: Math.sign(mondayOf(day, TZ) - mondayOf(shown.day, TZ)) });
  }
  const inView = span === 1 ? [day] : [day, addDays(day, 1, TZ)];
  const marked = new Set(pencils.map((p) => startOfDay(p.start, TZ)));

  // One of your events, its details in a sheet; kept while the sheet slides away.
  const [detail, setDetail] = useState<DaySegment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const tapBlock = (segment: DaySegment) => {
    const action = actionOf(segment);
    if (action) return action();
    setDetail(segment);
    setDetailOpen(true);
  };

  // The zoom out of the cell, as the view opens. Cancelled on cleanup, so
  // React's second run in development starts it afresh rather than
  // measuring a view already mid-zoom.
  const box = useRef<HTMLDivElement>(null);
  const zoomedOut = (el: HTMLElement, cell: DOMRect): Keyframe => {
    const scale = cell.width / el.offsetWidth;
    const below = Math.max(el.offsetHeight - cell.height / scale, 0);
    return {
      // From its own place: under the website's header, it starts lower.
      transform: `translate(${cell.left}px, ${cell.top - top}px) scale(${scale})`,
      clipPath: `inset(0px 0px ${below}px 0px round ${12 / scale}px)`,
      opacity: 0,
    };
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || reduceMotion) return;
    const cell = cellOf(day, false);
    const zoom = cell
      ? el.animate([zoomedOut(el, cell), { opacity: 1, offset: 0.3 }, FULL], {
          duration: ZOOM.inMs,
          easing: ZOOM.easing,
        })
      : el.animate(
          [
            { opacity: 0, transform: "scale(0.96)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 220, easing: "ease-out" },
        );
    return () => zoom.cancel();
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closed (‹ Oktober, or the phone's back): into the cell of the day it is on.
  const closed = useRef(onClosed);
  useEffect(() => {
    closed.current = onClosed;
  });
  useEffect(() => {
    if (open) return;
    const el = box.current;
    if (!el || reduceMotion) {
      closed.current();
      return;
    }
    const cell = cellOf(day, true);
    const zoom = cell
      ? el.animate([FULL, { opacity: 1, offset: 0.7 }, zoomedOut(el, cell)], {
          duration: ZOOM.outMs,
          easing: ZOOM.easing,
          fill: "forwards",
        })
      : el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
    zoom.finished.then(
      () => closed.current(),
      () => {},
    );
    return () => zoom.cancel();
    // Only as it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={box}
      role="region"
      aria-label={capitalize(dayLabel(day, lang))}
      inert={!open}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-background"
      style={{ top, transformOrigin: "0 0" }}
    >
      {/* The toolbar's room: it stays where it is, over the day growing in. */}
      <div aria-hidden className="shrink-0" style={{ height: room }} />

      <div className="flex min-h-0 flex-1 flex-col" onPointerDownCapture={onTouchDays}>
        <WeekStrip
          center={day}
          inView={inView}
          today={today}
          marked={marked}
          turn={shown.turn}
          tone="orange"
          onPick={onDay}
          onWeek={(direction) => onDay(addDays(day, 7 * direction, TZ))}
        />

        <div className="min-h-0 flex-1 border-t">
          <DayColumns
            home={home}
            offset={daysBetween(home, day)}
            onOffset={(to) => onDay(addDays(home, to, TZ))}
            days={span}
            lead="first"
            pencils={pencils}
            onBlockTap={tapBlock}
            travel={travel}
            aim={aim}
            clear={clear}
            tone="orange"
            calendar={calendar}
            size="full"
          />
        </div>
      </div>

      {children}

      <BottomSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail ? capitalize(dayLabel(detail.start, lang)) : ""}
        doneLabel={t.swipe.done}
      >
        {detail && (
          <ul>
            <DayRow
              seg={detail}
              calendar={calendarById.get(detail.calendarId)}
              rgb={calendar.colorOf(detail.calendarId)}
            />
          </ul>
        )}
      </BottomSheet>
    </div>
  );
}
