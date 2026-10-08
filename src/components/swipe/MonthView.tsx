import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { capitalize } from "@/lib/format";
import { layoutWeek, type GridItem } from "@/lib/monthGrid";
import { shade, tint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Rows of chips under a day's number, a row's height, and the "+2" line under them. */
const LANES = 3;
const LANE_PX = 20;
const MORE_PX = 14;

/**
 * Your calendar a month at a time, drawn like Apple Calendar's month view
 * (#74), for looking further ahead than three days (a holiday, a trip): the
 * months searched one under the other, the weekdays kept on top, week
 * numbers down the left, each day's events as tinted chips under its number
 * and anything lasting days as one bar across them (lib/monthGrid.ts),
 * today in red, the vote's dates in orange and the one being answered
 * pencilled in. A tap on a day opens it in the day view.
 */
export default function MonthView({
  focus,
  calendar,
  pencil,
  marked,
  onPickDay,
}: {
  /** The day whose month to open on. */
  focus: number;
  calendar: MyCalendarDays;
  /** The date being answered, pencilled in dashed; none on My calendar. */
  pencil?: { start: number; end: number; label: string };
  /** The vote's dates, as local midnights; none on My calendar. */
  marked?: ReadonlySet<number>;
  onPickDay: (day: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const scroller = useRef<HTMLDivElement>(null);
  const monthEls = useRef(new Map<number, HTMLElement>());
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => startOfMonth(Date.parse(SEARCH_WINDOW.start), TZ, i)),
    [],
  );
  const items = useMemo(
    (): GridItem[] =>
      pencil
        ? [{ calendarId: "pencil", ...pencil, pencil: true }, ...calendar.items]
        : calendar.items,
    [pencil, calendar.items],
  );
  // Today, for the red circle: fixed for as long as the view is open.
  const [today] = useState(() => startOfDay(Date.now(), TZ));
  const thisYear = localDate(today, TZ).year;

  // Open on the focused month.
  useLayoutEffect(() => {
    const el = monthEls.current.get(startOfMonth(focus, TZ));
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 28;
    // Only on opening: the view is opened afresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scroller} className="relative h-full overflow-y-auto overscroll-contain">
      {/* The weekdays, kept on top while the months scroll under them. */}
      <div className="sticky top-0 z-20 grid h-7 grid-cols-7 items-center border-b bg-background/95 text-center text-[12px] font-medium backdrop-blur">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <span key={dow} className={dow === 0 || dow === 6 ? "text-muted-foreground" : ""}>
            {t.weekdaysShort[dow].charAt(0)}
          </span>
        ))}
      </div>

      {months.map((month) => {
        const { year, month: m } = localDate(month, TZ);
        const layout = buildMonthLayout(year, m, TZ, LOCALE[lang]);
        const name = capitalize(
          new Date(month).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
        );
        return (
          <section
            key={month}
            ref={(el) => {
              if (el) monthEls.current.set(month, el);
            }}
          >
            <h3 className="px-3 pb-1 pt-5 text-[28px] font-bold tracking-tight text-foreground">
              {year === thisYear ? name : `${name} ${year}`}
            </h3>
            {layout.weeks.map((week, w) => {
              const days = week.map((d) => d.date.getTime());
              const inMonth = week.map((d) => d.inMonth);
              const first = inMonth.indexOf(true);
              const last = inMonth.lastIndexOf(true);
              const { placed, hidden } = layoutWeek(items, days, addDays(days[6], 1, TZ), LANES);
              return (
                <div key={w} className="relative border-t border-border/70">
                  <span className="absolute left-1 top-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {layout.weekNumbers[w]}
                  </span>
                  <div className="grid grid-cols-7">
                    {week.map((d, c) => (
                      <span key={d.key} className="flex h-10 items-center justify-center">
                        {d.inMonth && (
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-[18px]",
                              days[c] === today
                                ? "bg-red-500 font-semibold text-white"
                                : marked?.has(days[c])
                                  ? "font-bold text-primary"
                                  : c >= 5
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                            )}
                          >
                            {d.dayOfMonth}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="relative" style={{ height: LANES * LANE_PX + MORE_PX }}>
                    {placed.map((p, i) => {
                      // Cut at the month's own days, as Apple leaves the others empty.
                      const from = Math.max(p.from, first);
                      const to = Math.min(p.to, last);
                      if (from > to) return null;
                      const before = p.continuesBefore || from > p.from;
                      const after = p.continuesAfter || to < p.to;
                      const rgb = calendar.colorOf(p.item.calendarId);
                      return (
                        <p
                          key={i}
                          className={cn(
                            "pointer-events-none absolute truncate px-1 text-[11px] font-semibold leading-[16px]",
                            !before && "rounded-l-[4px]",
                            !after && "rounded-r-[4px]",
                            p.item.pencil &&
                              "border border-dashed border-primary bg-primary/10 text-primary",
                          )}
                          style={{
                            top: p.lane * LANE_PX,
                            height: LANE_PX - 3,
                            left: `calc(${(from / 7) * 100}% + ${before ? 0 : 2}px)`,
                            width: `calc(${((to - from + 1) / 7) * 100}% - ${(before ? 0 : 2) + (after ? 0 : 2)}px)`,
                            ...(p.item.pencil
                              ? {}
                              : { background: `rgb(${tint(rgb)})`, color: `rgb(${shade(rgb)})` }),
                          }}
                        >
                          {p.item.label}
                        </p>
                      );
                    })}
                    {hidden.map(
                      (n, c) =>
                        n > 0 &&
                        inMonth[c] && (
                          <span
                            key={c}
                            className="pointer-events-none absolute bottom-0 text-center text-[10px] text-muted-foreground"
                            style={{ left: `${(c / 7) * 100}%`, width: `${100 / 7}%` }}
                          >
                            +{n}
                          </span>
                        ),
                    )}
                  </div>
                  {/* A tap anywhere on a day opens it. */}
                  <div className="absolute inset-0 grid grid-cols-7">
                    {week.map((d, c) =>
                      d.inMonth ? (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => onPickDay(days[c])}
                          aria-label={d.date.toLocaleDateString(LOCALE[lang], {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            timeZone: TZ,
                          })}
                        />
                      ) : (
                        <span key={d.key} />
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
