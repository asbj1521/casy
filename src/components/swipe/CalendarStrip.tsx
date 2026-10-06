import { useRef } from "react";
import { Link } from "react-router-dom";
import { Maximize2 } from "lucide-react";

import DayColumns from "@/components/swipe/DayColumns";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useT } from "@/i18n/lang";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * The strip's height: on a phone about seven hours of the day, leaving the
 * card its room; on a computer, beside the card, the card and its answers'
 * height, with the whole day fitted into it.
 */
const STRIP_PX = 246;
const FIT_PX = 446;

/**
 * Your own calendar around a suggested date (#74), under its swipe card: the
 * day before, the day and the day after, drawn like Apple Calendar
 * (DayColumns) and opened on the suggested time, or on a computer (`fit`)
 * the whole day from midnight to midnight. A tap zooms the whole calendar
 * out of it (CalendarSheet), told where the strip is on screen.
 */
export default function CalendarStrip({
  date,
  slotLabel,
  calendar,
  onOpen,
  fit = false,
}: {
  date: { start: string; end: string };
  slotLabel: string;
  calendar: MyCalendarDays;
  /** Open the whole calendar, growing out of the strip's place on screen. */
  onOpen: (from: DOMRect) => void;
  /** A computer: taller, beside the card, the whole day without scrolling. */
  fit?: boolean;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const open = () => {
    if (box.current) onOpen(box.current.getBoundingClientRect());
  };

  if (calendar.none) {
    return (
      <p className="rounded-xl border bg-card px-3 py-2.5 text-sm text-muted-foreground">
        {t.swipe.noCalendar}{" "}
        <Link to="/calendar-overview/accounts" className="font-medium text-primary underline">
          {t.swipe.connect}
        </Link>
      </p>
    );
  }

  return (
    <div
      ref={box}
      role="button"
      tabIndex={0}
      aria-label={t.swipe.openCalendar}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="relative cursor-pointer overflow-hidden rounded-[14px] border bg-card shadow-sm"
      style={{ height: fit ? FIT_PX : STRIP_PX }}
    >
      <DayColumns
        home={startOfDay(start, TZ)}
        slot={{ start, end }}
        slotLabel={slotLabel}
        calendar={calendar}
        size="compact"
        fitDay={fit}
        // It opens: said in the corner, where the week number would be.
        corner={
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Maximize2 className="h-3 w-3" />
          </span>
        }
      />
    </div>
  );
}
