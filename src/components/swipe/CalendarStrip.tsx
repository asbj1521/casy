import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { firstHour, placeBlocks, placeSpan, STRIP_LAST_HOUR } from "@/lib/dayStrip";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, atHour, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** The time axis's height in pixels: enough to read, small enough to leave the card room. */
const AXIS_PX = 132;
/** A block shorter than this many pixels gets no label. */
const LABEL_MIN_PX = 10;

/**
 * Your own calendar around a suggested date (#74): the day before, the day
 * and the day after, side by side on a time axis, with the suggested time
 * outlined. Arrows step the three days through your calendar, and "Your
 * calendar" opens all of it (CalendarSheet), so checking never means leaving
 * the swipe screen. Calendar names only: Casy stores no event titles.
 */
export default function CalendarStrip({
  date,
  calendar,
  onOpenCalendar,
}: {
  date: { start: string; end: string };
  calendar: MyCalendarDays;
  /** Open the whole calendar on this day. */
  onOpenCalendar: (day: Date) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  // Days stepped away from the suggested one.
  const [offset, setOffset] = useState(0);
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const center = addDays(startOfDay(start, TZ), offset, TZ);
  const days = [-1, 0, 1].map((i) => {
    const midnight = addDays(center, i, TZ);
    return { midnight, segments: calendar.segmentsOn(new Date(midnight)) };
  });
  const from = firstHour(days, { start, midnight: startOfDay(start, TZ) }, TZ);
  const hourMarks = [from, 12, 18].filter((h, i) => i === 0 || h > from + 1);

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
    <section aria-label={t.swipe.yourCalendar} className="rounded-xl border bg-card p-2">
      <div className="flex">
        {/* The hours, along the left. */}
        <div className="relative mt-[38px] w-6 shrink-0" style={{ height: AXIS_PX }}>
          {hourMarks.map((h) => (
            <span
              key={h}
              className="absolute -translate-y-1/2 text-[9px] tabular-nums text-muted-foreground"
              style={{ top: `${((h - from) / (STRIP_LAST_HOUR - from)) * 100}%` }}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          {days.map(({ midnight, segments }) => {
            const day = new Date(midnight);
            const next = addDays(midnight, 1, TZ);
            const isEventDay = start < next && end > midnight;
            const allDay = segments.filter((s) => s.allDay);
            const blocks = placeBlocks(segments, midnight, from, TZ);
            const slot = isEventDay && placeSpan(start, end, midnight, from, TZ);
            return (
              <div key={midnight} className="min-w-0">
                <p
                  className={cn(
                    "truncate text-center text-[11px] font-semibold",
                    isEventDay ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {day.toLocaleDateString(LOCALE[lang], {
                    weekday: "short",
                    day: "numeric",
                    timeZone: TZ,
                  })}
                </p>
                {/* Whole-day entries: holidays, and anything lasting the day. */}
                <div className="mt-0.5 h-5 overflow-hidden">
                  {allDay.slice(0, 1).map((s, i) => (
                    <p
                      key={i}
                      className="truncate rounded px-1 text-[10px] font-medium leading-5"
                      style={{
                        background: `rgba(${calendar.colorOf(s.calendarId)}, 0.18)`,
                        color: `rgb(${calendar.colorOf(s.calendarId)})`,
                      }}
                    >
                      {calendar.labelOf(s)}
                      {allDay.length > 1 && ` +${allDay.length - 1}`}
                    </p>
                  ))}
                </div>
                <div
                  className="relative mt-1 overflow-hidden rounded-md bg-secondary/50"
                  style={{ height: AXIS_PX }}
                >
                  {/* Faint lines at the hours marked on the left. */}
                  {hourMarks.slice(1).map((h) => (
                    <div
                      key={h}
                      aria-hidden
                      className="absolute inset-x-0 border-t border-border/70"
                      style={{ top: `${((h - from) / (STRIP_LAST_HOUR - from)) * 100}%` }}
                    />
                  ))}
                  {calendar.loading ? (
                    <div
                      aria-hidden
                      className="absolute inset-1 animate-pulse rounded bg-secondary"
                    />
                  ) : (
                    blocks.map((b, i) => {
                      const rgb = calendar.colorOf(b.segment.calendarId);
                      return (
                        <div
                          key={i}
                          className="absolute overflow-hidden rounded-[3px] border-l-2 px-0.5"
                          style={{
                            top: `${b.top * 100}%`,
                            height: `max(${b.height * 100}%, 3px)`,
                            left: `${(b.lane / b.lanes) * 100}%`,
                            width: `${100 / b.lanes}%`,
                            background: `rgba(${rgb}, 0.22)`,
                            borderColor: `rgb(${rgb})`,
                          }}
                        >
                          {b.height * AXIS_PX >= LABEL_MIN_PX && (
                            <span
                              className="block truncate text-[9px] font-medium leading-[10px]"
                              style={{ color: `rgb(${rgb})` }}
                            >
                              {calendar.labelOf(b.segment)}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                  {/* The suggested time, on top of whatever it overlaps. */}
                  {slot && slot.height > 0 && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 rounded-[4px] border-2 border-dashed border-primary bg-primary/10"
                      style={{ top: `${slot.top * 100}%`, height: `${slot.height * 100}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label={t.swipe.dayBack}
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            aria-label={t.swipe.dayOn}
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded-full px-2 py-1 text-xs font-medium text-primary"
            >
              {t.swipe.backToDate}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenCalendar(new Date(atHour(center, 12, TZ)))}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary"
        >
          <CalendarDays className="h-4 w-4" />
          {t.swipe.yourCalendar}
        </button>
      </div>
    </section>
  );
}
