import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

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
 *
 * On My calendar (#104) there is no vote: `selected` is the day tapped, in
 * orange, and today is a grey circle so the two never look alike
 * (`todayTone`). Each month is memoised, so a tap redraws only the months
 * whose selected day changed, not all twelve.
 */
export default function MonthView({
  focus,
  calendar,
  pencil,
  marked,
  selected = null,
  todayTone = "red",
  onPickDay,
}: {
  /** The day whose month to open on. */
  focus: number;
  calendar: MyCalendarDays;
  /** The date being answered, pencilled in dashed; none on My calendar. */
  pencil?: { start: number; end: number; label: string };
  /** The vote's dates, as local midnights; none on My calendar. */
  marked?: ReadonlySet<number>;
  /** The day tapped, as a local midnight: ringed in orange. */
  selected?: number | null;
  /** How today is drawn: Apple's red circle, or a grey one where orange marks the tapped day. */
  todayTone?: "red" | "grey";
  onPickDay: (day: number) => void;
}) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const monthEls = useRef(new Map<number, HTMLElement>());
  const register = useCallback((month: number, el: HTMLElement | null) => {
    if (el) monthEls.current.set(month, el);
  }, []);
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
  // Today, for its circle: fixed for as long as the view is open.
  const [today] = useState(() => startOfDay(Date.now(), TZ));
  const thisYear = localDate(today, TZ).year;

  // Open on the focused month.
  useLayoutEffect(() => {
    const el = monthEls.current.get(startOfMonth(focus, TZ));
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop;
    // Only on opening: the view is opened afresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* The weekdays, above the months rather than stuck inside their
          scroller: iOS Safari left a sliver over a sticky row where the
          months showed as they scrolled under it. Here they are clipped at
          the scroller's own edge. */}
      <div className="grid h-7 shrink-0 grid-cols-7 items-center border-b bg-background text-center text-[12px] font-medium">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <span key={dow} className={dow === 0 || dow === 6 ? "text-muted-foreground" : ""}>
            {t.weekdaysShort[dow].charAt(0)}
          </span>
        ))}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {months.map((month) => {
          const { year, month: m } = localDate(month, TZ);
          const inMonth =
            selected !== null &&
            localDate(selected, TZ).month === m &&
            localDate(selected, TZ).year === year;
          return (
            <MonthSection
              key={month}
              month={month}
              showYear={year !== thisYear}
              items={items}
              colorOf={calendar.colorOf}
              today={today}
              todayTone={todayTone}
              marked={marked}
              selected={inMonth ? selected : null}
              onPickDay={onPickDay}
              register={register}
            />
          );
        })}
      </div>
    </div>
  );
}

const MonthSection = memo(function MonthSection({
  month,
  showYear,
  items,
  colorOf,
  today,
  todayTone,
  marked,
  selected,
  onPickDay,
  register,
}: {
  month: number;
  showYear: boolean;
  items: GridItem[];
  colorOf: (calendarId: string) => string;
  today: number;
  todayTone: "red" | "grey";
  marked?: ReadonlySet<number>;
  selected: number | null;
  onPickDay: (day: number) => void;
  register: (month: number, el: HTMLElement | null) => void;
}) {
  const { lang } = useLang();
  const { year, month: m } = localDate(month, TZ);
  const layout = useMemo(() => buildMonthLayout(year, m, TZ, LOCALE[lang]), [year, m, lang]);
  const name = capitalize(
    new Date(month).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  // Where each week's items sit: the costly part, so only when the items change.
  const weeks = useMemo(
    () =>
      layout.weeks.map((week) => {
        const days = week.map((d) => d.date.getTime());
        return { week, days, ...layoutWeek(items, days, addDays(days[6], 1, TZ), LANES) };
      }),
    [layout, items],
  );

  return (
    <section ref={(el) => register(month, el)}>
      <h3 className="px-3 pb-1 pt-5 text-[28px] font-bold tracking-tight text-foreground">
        {showYear ? `${name} ${year}` : name}
      </h3>
      {weeks.map(({ week, days, placed, hidden }, w) => {
        const inMonth = week.map((d) => d.inMonth);
        const first = inMonth.indexOf(true);
        const last = inMonth.lastIndexOf(true);
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
                        days[c] === selected
                          ? "bg-primary font-semibold text-primary-foreground"
                          : days[c] === today
                            ? todayTone === "red"
                              ? "bg-red-500 font-semibold text-white"
                              : "bg-zinc-200 font-semibold text-foreground"
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
                const rgb = colorOf(p.item.calendarId);
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
                    data-day={days[c]}
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
});
