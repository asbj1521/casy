import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { capitalize } from "@/lib/format";
import { layoutWeek, type GridItem } from "@/lib/monthGrid";
import { MONTH_LABEL_PX, monthScrollTop } from "@/lib/monthScroll";
import { useIsDark } from "@/hooks/useIsDark";
import { shade, tint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Rows of chips under a day's number, a row's height, and the "+2" line under them. */
const LANES = 3;
const LANE_PX = 20;
const MORE_PX = 14;
/** How long the month rests on opening before it glides to what it reveals. */
const REVEAL_DELAY_MS = 450;
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
 *
 * With a `header` the months are laid out as Apple's does on a phone: the
 * header (the toolbar the page gives), the name of the month on screen and the
 * weekdays stay put on top, translucent, and the months scroll under them and
 * show through; the title changes as the months pass beneath it, and each month
 * starts with its short name over the column of its first day instead of a
 * heading of its own.
 */
export default function MonthView({
  focus,
  calendar,
  pencil,
  marked,
  selected = null,
  todayTone = "red",
  reveal = null,
  header,
  onPickDay,
}: {
  /**
   * The page's toolbar, drawn over the months in a translucent block with the
   * month's name and the weekdays under it. Without it the months have their
   * own headings and the weekdays sit above them, as the swipe screen draws it.
   */
  header?: ReactNode;
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
  /**
   * A day to glide to once it is set (a local midnight): My calendar shows
   * the person a trip it found (#115). A third of the way down, so the weeks
   * around it show too.
   */
  reveal?: number | null;
  onPickDay: (day: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const floating = header !== undefined;
  const scroller = useRef<HTMLDivElement>(null);
  const headerEl = useRef<HTMLDivElement>(null);
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

  // The floating header's height, which the months leave room for (null until
  // measured, so the view opens on its month only once it is known).
  const [pad, setPad] = useState<number | null>(floating ? null : 0);
  // The month the title names: the one whose first week is under the header.
  const [titleMonth, setTitleMonth] = useState(() => startOfMonth(focus, TZ));

  useLayoutEffect(() => {
    const el = headerEl.current;
    if (!floating || !el) return;
    const measure = () => setPad(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [floating]);

  const track = useCallback(() => {
    const box = scroller.current;
    if (!box || !floating) return;
    const line = box.scrollTop + (pad ?? 0) + 2;
    let current = months[0];
    for (const m of months) {
      const el = monthEls.current.get(m);
      if (el && el.offsetTop + MONTH_LABEL_PX <= line) current = m;
    }
    // Only a change of month redraws, however fast it scrolls.
    setTitleMonth(current);
  }, [floating, pad, months]);

  // Open on the focused month, once the header's height is known.
  const opened = useRef(false);
  useLayoutEffect(() => {
    const box = scroller.current;
    if (pad === null || !box) return;
    if (!opened.current) {
      opened.current = true;
      const el = monthEls.current.get(startOfMonth(focus, TZ));
      if (el) box.scrollTop = monthScrollTop(box, el);
    }
    track();
    // Only on opening: the view is opened afresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pad === null]);

  // A header that changes height (a notice arriving) pushes the months down by
  // the same amount, so what was on screen stays where it was.
  const lastPad = useRef<number | null>(null);
  useLayoutEffect(() => {
    const box = scroller.current;
    if (pad !== null && lastPad.current !== null && box) box.scrollTop += pad - lastPad.current;
    lastPad.current = pad;
  }, [pad]);

  useEffect(() => {
    if (reveal === null) return;
    const timer = setTimeout(() => {
      const box = scroller.current;
      const cell = box?.querySelector<HTMLElement>(`[data-day="${reveal}"]`);
      if (!box || !cell) return;
      const top =
        box.scrollTop +
        cell.getBoundingClientRect().top -
        box.getBoundingClientRect().top -
        box.clientHeight / 3;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollTo({ top: Math.max(0, top), behavior: still ? "auto" : "smooth" });
    }, REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [reveal]);

  const sections = months.map((month) => {
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
        compact={floating}
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
  });
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dow) => (
    <span key={dow} className={dow === 0 || dow === 6 ? "text-muted-foreground" : ""}>
      {t.weekdaysShort[dow].charAt(0)}
    </span>
  ));

  if (floating) {
    const { year } = localDate(titleMonth, TZ);
    const name = capitalize(
      new Date(titleMonth).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
    );
    return (
      <div className="relative h-full">
        <div
          ref={scroller}
          data-floating-header=""
          className="relative h-full overflow-y-auto overscroll-contain"
          style={{ paddingTop: pad ?? 0, scrollPaddingTop: pad ?? 0 }}
          onScroll={track}
        >
          {sections}
        </div>
        <div ref={headerEl} className="absolute inset-x-0 top-0 z-10">
          {/* The blur is a layer of its own: the capsules in the header blur
              what is behind them, which a backdrop filter's child can't. */}
          <div aria-hidden className="glass-bar pointer-events-none absolute inset-0" />
          <div className="relative pb-1.5">
            {header}
            <h2 className="px-3 pb-1 pt-1 text-[30px] font-bold leading-tight tracking-tight text-foreground">
              {year !== thisYear ? `${name} ${year}` : name}
            </h2>
            <div className="grid h-6 grid-cols-7 items-center text-center text-[12px] font-medium">
              {weekdays}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* The weekdays, above the months rather than stuck inside their
          scroller: iOS Safari left a sliver over a sticky row where the
          months showed as they scrolled under it. Here they are clipped at
          the scroller's own edge. */}
      <div className="grid h-7 shrink-0 grid-cols-7 items-center border-b bg-background text-center text-[12px] font-medium">
        {weekdays}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {sections}
      </div>
    </div>
  );
}

const NOOP = () => {};

/**
 * One month of the view on its own, for anyone's busy time: a layer of the
 * paper pile (#126), drawn exactly like My calendar's month under it so the
 * two line up. Nothing on it can be tapped.
 */
export function MonthLayer({
  month,
  items,
  colorOf,
  shine,
  wrapRow,
}: {
  /** The month's first local midnight. */
  month: number;
  items: GridItem[];
  colorOf: (calendarId: string) => string;
  /** Days lit up in green: the ones free for everyone. */
  shine?: ReadonlySet<number>;
  /** Wraps each week's row (`w` of `count`), for animating the rows on their own. */
  wrapRow?: (w: number, count: number, row: ReactNode) => ReactNode;
}) {
  const [today] = useState(() => startOfDay(Date.now(), TZ));
  return (
    // A picture of a month, not a calendar to use: out of reach of taps and screen readers.
    <div inert className="pointer-events-none">
      <MonthSection
        month={month}
        showYear={localDate(month, TZ).year !== localDate(today, TZ).year}
        compact
        items={items}
        colorOf={colorOf}
        today={today}
        todayTone="grey"
        selected={null}
        onPickDay={NOOP}
        register={NOOP}
        shine={shine}
        wrapRow={wrapRow}
      />
    </div>
  );
}

const MonthSection = memo(function MonthSection({
  month,
  showYear,
  compact,
  items,
  colorOf,
  today,
  todayTone,
  marked,
  selected,
  onPickDay,
  register,
  shine,
  wrapRow,
}: {
  month: number;
  showYear: boolean;
  /** Under a floating header: a short name over the first day, not a heading. */
  compact: boolean;
  items: GridItem[];
  colorOf: (calendarId: string) => string;
  today: number;
  todayTone: "red" | "grey";
  marked?: ReadonlySet<number>;
  selected: number | null;
  onPickDay: (day: number) => void;
  register: (month: number, el: HTMLElement | null) => void;
  shine?: ReadonlySet<number>;
  wrapRow?: (w: number, count: number, row: ReactNode) => ReactNode;
}) {
  // Calendar colours are worked out in code, so they follow the theme here.
  const dark = useIsDark();
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

  // Apple's short name ("Nov"), over the column of the month's first day.
  const firstColumn = Math.max(
    0,
    layout.weeks[0].findIndex((d) => d.inMonth),
  );
  const shortName = capitalize(
    new Date(month)
      .toLocaleDateString(LOCALE[lang], { month: "short", timeZone: TZ })
      .replace(/\.$/, ""),
  );

  return (
    // data-month: the paper pile (#126) finds the month here to line up with it.
    <section ref={(el) => register(month, el)} data-month={month}>
      {compact ? (
        <div aria-hidden className="relative" style={{ height: MONTH_LABEL_PX }}>
          <span
            className="absolute top-[3px] truncate text-center text-[17px] font-bold leading-none text-foreground"
            style={{ left: `${(firstColumn / 7) * 100}%`, width: `${100 / 7}%` }}
          >
            {shortName}
          </span>
        </div>
      ) : (
        <h3 className="px-3 pb-1 pt-5 text-[28px] font-bold tracking-tight text-foreground">
          {showYear ? `${name} ${year}` : name}
        </h3>
      )}
      {weeks.map(({ week, days, placed, hidden }, w) => {
        const inMonth = week.map((d) => d.inMonth);
        const first = inMonth.indexOf(true);
        const last = inMonth.lastIndexOf(true);
        const row = (
          <div key={w} className="relative border-t border-border/70">
            <span className="absolute left-1 top-0.5 text-[10px] tabular-nums text-muted-foreground">
              {layout.weekNumbers[w]}
            </span>
            <div className="grid grid-cols-7">
              {week.map((d, c) => (
                <span key={d.key} className="flex h-10 items-center justify-center">
                  {d.inMonth && (
                    <span
                      // The paper pile's dates fly up out of their green circle (#126).
                      data-shine={shine?.has(days[c]) ? days[c] : undefined}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-[18px]",
                        shine?.has(days[c])
                          ? "bg-emerald-500 font-semibold text-white shadow-[0_0_14px_rgba(16,185,129,0.7)]"
                          : days[c] === selected
                            ? "bg-primary font-semibold text-primary-foreground"
                            : days[c] === today
                              ? todayTone === "red"
                                ? "bg-red-500 font-semibold text-white"
                                : "bg-zinc-200 font-semibold text-foreground dark:bg-white/20"
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
                      p.item.pulse && "animate-trip-pulse",
                      p.item.grow && "transition-[left,width] duration-700 ease-out",
                    )}
                    style={{
                      top: p.lane * LANE_PX,
                      height: LANE_PX - 3,
                      left: `calc(${(from / 7) * 100}% + ${before ? 0 : 2}px)`,
                      width: `calc(${((to - from + 1) / 7) * 100}% - ${(before ? 0 : 2) + (after ? 0 : 2)}px)`,
                      ...(p.item.pencil
                        ? {}
                        : {
                            background: `rgb(${tint(rgb, dark)})`,
                            color: `rgb(${shade(rgb, dark)})`,
                          }),
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
        return wrapRow ? wrapRow(w, weeks.length, row) : row;
      })}
    </section>
  );
});
