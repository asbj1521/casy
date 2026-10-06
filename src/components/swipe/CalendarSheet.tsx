import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout, dayKey, formatSegmentRange } from "@/lib/calendarOverview";
import { capitalize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, localDate } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * All of your calendar, without leaving the swipe screen (#74): a month at a
 * time, each day dotted in its calendars' colours, this vote's dates ringed,
 * and the day tapped listed underneath (times and calendar names; Casy
 * stores no event titles). Slides up over the cards and back down on close.
 */
export default function CalendarSheet({
  initialDay,
  marked,
  calendar,
  onClose,
}: {
  initialDay: Date;
  /** The vote's dates, by day key ("YYYY-MM-DD"), ringed on the grid. */
  marked: ReadonlySet<string>;
  calendar: MyCalendarDays;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const reduceMotion = useReducedMotion();
  const [month, setMonth] = useState(() => {
    const { year, month } = localDate(initialDay.getTime(), TZ);
    return { year, month };
  });
  const [selected, setSelected] = useState(() => dayKey(initialDay, TZ));
  const layout = buildMonthLayout(month.year, month.month, TZ, LOCALE[lang]);
  const days = layout.weeks.flat();
  const selectedDay = days.find((d) => d.key === selected);
  const segments = selectedDay ? calendar.segmentsOn(selectedDay.date) : [];
  const todayKey = dayKey(new Date(), TZ);

  const shift = (delta: number) =>
    setMonth(({ year, month: m }) => {
      // Date.UTC rolls month 12 over into next January, with no clock involved.
      const d = new Date(Date.UTC(year, m + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-label={t.swipe.yourCalendar}
      initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
      animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 320 }}
      className="fixed inset-0 z-[70] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
    >
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <h2 className="text-[17px] font-semibold text-foreground">{t.swipe.yourCalendar}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.swipe.close}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t.swipe.monthBack}
            className="flex h-9 w-9 items-center justify-center rounded-full border"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-semibold text-foreground">{capitalize(layout.label)}</p>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t.swipe.monthOn}
            className="flex h-9 w-9 items-center justify-center rounded-full border"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
          {layout.weekdayLabels.map((w) => (
            <span key={w}>{w.replace(".", "")}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const daySegments = calendar.segmentsOn(d.date);
            const dots = [...new Set(daySegments.map((s) => s.calendarId))].slice(0, 3);
            const isSelected = d.key === selected;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelected(d.key)}
                aria-pressed={isSelected}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition",
                  !d.inMonth && "opacity-35",
                  isSelected
                    ? "bg-foreground text-background"
                    : marked.has(d.key)
                      ? "bg-primary/10 text-primary ring-2 ring-primary"
                      : "text-foreground",
                  d.key === todayKey && !isSelected && "underline underline-offset-4",
                )}
              >
                {d.dayOfMonth}
                <span className="flex h-1.5 gap-0.5">
                  {dots.map((id) => (
                    <span
                      key={id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: `rgb(${calendar.colorOf(id)})` }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {selectedDay && (
          <section className="mt-5">
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              {capitalize(
                selectedDay.date.toLocaleDateString(LOCALE[lang], {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: TZ,
                }),
              )}
              {marked.has(selectedDay.key) && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                  {t.swipe.suggested}
                </span>
              )}
            </h3>
            {segments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t.calendarView.nothingBusy}</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {segments.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `rgb(${calendar.colorOf(s.calendarId)})` }}
                    />
                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                      {formatSegmentRange(s, TZ, t.calendarView.allDay)}
                    </span>
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {calendar.labelOf(s)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </motion.div>
  );
}
