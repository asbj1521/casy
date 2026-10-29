import { useRef } from "react";
import { Link } from "react-router-dom";
import { Maximize2 } from "lucide-react";

import DayColumns from "@/components/swipe/DayColumns";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useT } from "@/i18n/lang";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * The strip's height on a phone: about seven hours of the day, leaving the
 * card its room. On a computer it is as tall as the card and its answers
 * beside it, with the whole day fitted in.
 */
const STRIP_PX = 246;

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
  focus,
}: {
  date: { start: string; end: string };
  slotLabel: string;
  calendar: MyCalendarDays;
  /** Open the whole calendar, growing out of the strip's place on screen. */
  onOpen: (from: DOMRect) => void;
  /** A computer: taller, beside the card, the whole day without scrolling. */
  fit?: boolean;
  /**
   * One of your events a warning is about ("Vis mig", #114): the days slide
   * to it, the date kept in view beside it when it is a day or two away, and
   * it is scrolled to and ringed. Null: back to the date.
   */
  focus?: { start: number; end: number } | null;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const home = startOfDay(start, TZ);
  // Offset 0 shows the day before, the date and the day after: an event one
  // or two days on stays beside the date, one further off takes the middle.
  const gap = focus ? Math.round((startOfDay(focus.start, TZ) - home) / 86_400_000) : 0;
  const offset = !focus
    ? 0
    : Math.abs(gap) <= 2
      ? Math.sign(gap) * Math.max(0, Math.abs(gap) - 1)
      : gap;
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
      style={{ height: fit ? "100%" : STRIP_PX }}
    >
      <DayColumns
        home={home}
        offset={offset}
        focus={focus ?? null}
        aim={{ start, end }}
        pencils={[{ key: "slot", start, end, label: slotLabel }]}
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
