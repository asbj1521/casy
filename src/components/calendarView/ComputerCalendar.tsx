import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import { DayRow } from "@/components/calendarView/DayRow";
import CalendarListPanel from "@/components/CalendarListPanel";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { useFillViewport } from "@/hooks/useFillViewport";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useMyCalendarView } from "@/hooks/useMyCalendarView";
import type { Messages } from "@/i18n/da";
import { LOCALE, useLang, useT, type Lang } from "@/i18n/lang";
import {
  buildMonthLayout,
  holidayName,
  type DaySegment,
  type MonthDay,
} from "@/lib/calendarOverview";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { capitalize, formatTime } from "@/lib/format";
import { layoutWeek, type GridItem } from "@/lib/monthGrid";
import { useIsDark } from "@/hooks/useIsDark";
import { shade, tint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, localDate, startOfDay, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** The months that can be shown: this one and the eleven after, the year Casy syncs. */
const MONTHS = 12;

/** A day's number line, one row of chips, and the "+2" line under them (px). */
const NUMBER_PX = 34;
const LANE_PX = 20;
const MORE_PX = 14;

/** How far a trackpad's sideways swipe must go (px) to turn the month. */
const SWIPE_AT = 80;

/** "Tue 22 Sept 2026, 2 busy blocks" plus any holiday names, for screen readers. */
function cellLabel(date: Date, segments: DaySegment[], t: Messages, lang: Lang): string {
  const busy = segments.filter((s) => !s.holiday).length;
  const holidays = segments.flatMap((s) => (s.holiday ? [holidayName(s.holiday, lang)] : []));
  const day = date.toLocaleDateString(LOCALE[lang], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
  return t.calendarView.cellLabel(day, busy, holidays.join(", "));
}

/**
 * My calendar on a computer (#104), laid out like Apple Calendar's month
 * view on a Mac, as the phone's is like the iPhone's: the calendars down a
 * sidebar on the left, and the month filling the rest of the window, one at
 * a time (‹ I dag ›, the arrow keys, or a trackpad's sideways swipe). Day
 * numbers sit top right, today in a grey circle and the day clicked in
 * orange; busy time is drawn as on a Mac, a timed block as a dot, its
 * calendar's name and its start, and anything lasting whole days as a
 * tinted bar across them (lib/monthGrid.ts). A click on a day opens what is
 * busy on it in a popover beside it; a click elsewhere or Esc closes it.
 */
export default function ComputerCalendar() {
  const t = useT();
  const { lang } = useLang();
  const words = t.calendarView;
  const calendarsHome = useCalendarsHome();
  const {
    calendar,
    calendars,
    calendarById,
    connectedCount,
    setCalendarsVisible,
    visibilityError,
  } = useMyCalendarView();

  const [today] = useState(() => startOfDay(Date.now(), TZ));
  const firstMonth = useMemo(() => startOfMonth(Date.parse(SEARCH_WINDOW.start), TZ), []);
  // Months from this one, and which way the last turn went (for the slide).
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState(0);
  const month = startOfMonth(firstMonth, TZ, page);
  const year = localDate(month, TZ).year;
  const layout = useMemo(() => {
    const at = localDate(month, TZ);
    return buildMonthLayout(at.year, at.month, TZ, LOCALE[lang]);
  }, [month, lang]);
  // Each week's days as instants, kept between renders so the memoised
  // weeks see the same array and stay as they are.
  const weekDays = useMemo(
    () => layout.weeks.map((week) => week.map((d) => d.date.getTime())),
    [layout],
  );
  const monthName = capitalize(
    new Date(month).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );

  const [selected, setSelected] = useState<number | null>(null);
  // Stable, or every memoised week would redraw on each click. The day
  // already open closes again.
  const pickDay = useCallback(
    (day: number) => setSelected((open) => (open === day ? null : day)),
    [],
  );
  const turnMonth = useCallback((by: number) => {
    setPage((p) => {
      const next = Math.min(Math.max(p + by, 0), MONTHS - 1);
      if (next !== p) {
        setTurn(Math.sign(by));
        setSelected(null);
      }
      return next;
    });
  }, []);
  const goToday = () => {
    setTurn(-1);
    setPage(0);
    setSelected(null);
  };

  // Esc closes the day; the arrow keys turn the month, unless typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") setSelected(null);
      else if (e.key === "ArrowLeft") turnMonth(-1);
      else if (e.key === "ArrowRight") turnMonth(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turnMonth]);

  // A trackpad's two-finger sideways swipe turns the month. Not passive, so
  // Safari doesn't also take it as "back".
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    let sum = 0;
    let resting = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (resting) return;
      sum += e.deltaX;
      if (Math.abs(sum) < SWIPE_AT) return;
      turnMonth(Math.sign(sum));
      sum = 0;
      // One month per swipe: the rest of its momentum is let go.
      resting = true;
      window.setTimeout(() => (resting = false), 600);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [turnMonth]);

  // A click anywhere but a day or the open popover closes it.
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected === null) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (popover.current?.contains(el) || el.closest("[data-day]")) return;
      setSelected(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [selected]);

  // How many rows of chips fit under a day's number, from the grid's height.
  const grid = useRef<HTMLDivElement>(null);
  const [lanes, setLanes] = useState(3);
  const weeks = layout.weeks.length;
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => {
      const row = el.clientHeight / weeks;
      setLanes(Math.max(1, Math.floor((row - NUMBER_PX - MORE_PX) / LANE_PX)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [weeks]);

  // The whole thing takes the window's height under the header, on a wide
  // enough screen to sit side by side.
  const box = useRef<HTMLDivElement>(null);
  const height = useFillViewport(box, { bottom: 24, min: 560 });

  // Where the popover opens: beside the day, on whichever side has room,
  // growing down from a top row and up from a bottom one.
  const at = useMemo(() => {
    if (selected === null) return null;
    const row = layout.weeks.findIndex((w) => w.some((d) => d.date.getTime() === selected));
    if (row === -1) return null;
    const col = layout.weeks[row].findIndex((d) => d.date.getTime() === selected);
    const right = col <= 3;
    const down = row < weeks / 2;
    const style: CSSProperties = {
      ...(right
        ? { left: `calc(${((col + 1) / 7) * 100}% + 6px)` }
        : { right: `calc(${((7 - col) / 7) * 100}% + 6px)` }),
      ...(down
        ? { top: `${(row / weeks) * 100}%` }
        : { bottom: `${((weeks - row - 1) / weeks) * 100}%` }),
      transformOrigin: `${right ? "left" : "right"} ${down ? "top" : "bottom"}`,
    };
    return { day: selected, style };
  }, [selected, layout, weeks]);
  const daySegments = at ? calendar.segmentsOn(new Date(at.day)) : [];
  const dayTitle = at
    ? capitalize(
        new Date(at.day).toLocaleDateString(LOCALE[lang], {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: TZ,
        }),
      )
    : "";

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-6 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="sr-only">{words.title}</h1>
        <div
          ref={box}
          className="grid gap-x-8 gap-y-6 lg:h-[var(--fill)] lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]"
          style={{ "--fill": height === null ? "auto" : `${height}px` } as CSSProperties}
        >
          {/* The calendars, as a Mac's sidebar lists them. Under the month
              where the screen is too narrow for both. */}
          <aside className="order-2 min-h-0 lg:order-1 lg:overflow-y-auto lg:pb-2">
            <ListGroup className="mb-4 mt-0">
              <ListRow
                to={calendarsHome.to}
                icon={CalendarPlus}
                label={t.calendarAccounts.row}
                detail={t.calendarAccounts.rowDetail}
                value={calendar.loading ? null : connectedCount}
              />
            </ListGroup>
            <CalendarListPanel
              introInTip
              calendars={calendars}
              colorOf={calendar.colorOf}
              onSetVisible={setCalendarsVisible}
              visibilityError={visibilityError}
            />
            <p className="mt-4 px-1 text-xs text-muted-foreground">{words.intro}</p>
            <DanishTimeNote className="mt-1 px-1" />
          </aside>

          <section className="order-1 flex h-[680px] min-h-0 min-w-0 flex-col lg:order-2 lg:h-auto">
            <div className="flex items-center justify-between gap-4 pb-3">
              <h2 className="flex items-center gap-2 text-[28px] font-bold tracking-tight text-foreground">
                <span>
                  {monthName} <span className="font-normal">{year}</span>
                </span>
                {calendar.loading && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </h2>
              <div className="flex items-center rounded-lg border bg-card text-sm font-medium shadow-sm">
                <button
                  type="button"
                  onClick={() => turnMonth(-1)}
                  disabled={page === 0}
                  aria-label={t.common.previousMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-l-lg text-foreground transition hover:bg-secondary disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="h-8 border-x px-3 text-foreground transition hover:bg-secondary"
                >
                  {words.today}
                </button>
                <button
                  type="button"
                  onClick={() => turnMonth(1)}
                  disabled={page === MONTHS - 1}
                  aria-label={t.common.nextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-r-lg text-foreground transition hover:bg-secondary disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {calendar.error && (
              <Notice tone="error" className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  {calendar.error.message}
                  <button
                    type="button"
                    onClick={calendar.retry}
                    className="shrink-0 font-medium underline underline-offset-2"
                  >
                    {words.tryAgain}
                  </button>
                </div>
              </Notice>
            )}
            {calendar.truncated && (
              <Notice tone="warning" className="mb-3">
                {words.truncated}
              </Notice>
            )}
            {calendar.none && (
              <Notice tone="info" className="mb-3">
                {words.noCalendars(
                  <Link
                    to={calendarsHome.to}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {words.noCalendarsLink}
                  </Link>,
                )}
              </Notice>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="grid shrink-0 grid-cols-7 border-b">
                {layout.weekdayLabels.map((label, c) => (
                  <span
                    key={label}
                    className={cn(
                      "px-2 py-1.5 text-right text-[13px]",
                      c >= 5 ? "text-muted-foreground" : "text-foreground/80",
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              {/* The month and the popover over it; the popover is placed in
                  percentages of this box, so it needs no measuring. */}
              <div ref={area} className="relative min-h-0 flex-1">
                <motion.div
                  key={month}
                  ref={grid}
                  initial={
                    turn === 0 ? false : { opacity: 0, transform: `translateX(${turn * 24}px)` }
                  }
                  animate={{ opacity: 1, transform: "translateX(0px)" }}
                  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                  className="grid h-full"
                  style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
                >
                  {layout.weeks.map((week, w) => {
                    const days = weekDays[w];
                    const holds = selected !== null && days.includes(selected);
                    return (
                      <WeekRow
                        key={days[0]}
                        week={week}
                        days={days}
                        weekNumber={layout.weekNumbers[w]}
                        calendar={calendar}
                        lanes={lanes}
                        today={today}
                        selected={holds ? selected : null}
                        onPickDay={pickDay}
                      />
                    );
                  })}
                </motion.div>

                <AnimatePresence>
                  {at && (
                    <motion.div
                      key={at.day}
                      ref={popover}
                      role="dialog"
                      aria-label={dayTitle}
                      initial={{ opacity: 0, transform: "scale(0.96)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      exit={{ opacity: 0, transform: "scale(0.96)" }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute z-30 max-h-[85%] w-[340px] overflow-y-auto rounded-xl border bg-card p-4 shadow-xl"
                      style={at.style}
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h3 className="text-[15px] font-bold text-foreground">{dayTitle}</h3>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          aria-label={t.swipe.done}
                          className="-mr-1 -mt-0.5 rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {daySegments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{words.nothingBusy}</p>
                      ) : (
                        <ul className="divide-y">
                          {daySegments.map((seg, i) => (
                            <DayRow
                              key={i}
                              seg={seg}
                              calendar={calendarById.get(seg.calendarId)}
                              rgb={calendar.colorOf(seg.calendarId)}
                            />
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/**
 * Whether an item is drawn as a Mac draws an all-day event, a tinted bar:
 * it covers more than one day, or exactly a whole one.
 */
function isWholeDays(item: GridItem, spansDays: boolean): boolean {
  if (spansDays) return true;
  const midnight = startOfDay(item.start, TZ);
  return item.start === midnight && item.end >= addDays(midnight, 1, TZ);
}

/** One week of the month, memoised so a click redraws only the week it changes. */
const WeekRow = memo(function WeekRow({
  week,
  days,
  weekNumber,
  calendar,
  lanes,
  today,
  selected,
  onPickDay,
}: {
  week: MonthDay[];
  days: number[];
  weekNumber: number;
  calendar: MyCalendarDays;
  lanes: number;
  today: number;
  selected: number | null;
  onPickDay: (day: number) => void;
}) {
  // Calendar colours are worked out in code, so they follow the theme here.
  const dark = useIsDark();
  const t = useT();
  const { lang } = useLang();
  const { placed, hidden } = useMemo(
    () => layoutWeek(calendar.items, days, addDays(days[6], 1, TZ), lanes),
    [calendar.items, days, lanes],
  );

  return (
    <div className="relative grid grid-cols-7 border-t first:border-t-0">
      {week.map((d, c) => {
        const day = days[c];
        return (
          <button
            key={d.key}
            type="button"
            data-day={day}
            onClick={() => onPickDay(day)}
            aria-pressed={day === selected}
            aria-label={cellLabel(d.date, calendar.segmentsOn(d.date), t, lang)}
            className={cn(
              "relative border-l text-left transition-colors first:border-l-0 hover:bg-secondary/40",
              !d.inMonth && "bg-secondary/30",
            )}
          >
            {c === 0 && (
              <span className="absolute left-2 top-2 text-[11px] tabular-nums text-muted-foreground">
                {weekNumber}
              </span>
            )}
            <span
              className={cn(
                "absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular-nums",
                day === selected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : day === today
                    ? "bg-zinc-200 font-semibold text-foreground dark:bg-white/20"
                    : !d.inMonth
                      ? "text-muted-foreground/60"
                      : c >= 5
                        ? "text-muted-foreground"
                        : "text-foreground",
              )}
            >
              {d.dayOfMonth}
            </span>
          </button>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: NUMBER_PX }}>
        {placed.map((p, i) => {
          const rgb = calendar.colorOf(p.item.calendarId);
          const before = p.continuesBefore;
          const after = p.continuesAfter;
          const position: CSSProperties = {
            top: p.lane * LANE_PX,
            height: LANE_PX - 3,
            left: `calc(${(p.from / 7) * 100}% + ${before ? 0 : 3}px)`,
            width: `calc(${((p.to - p.from + 1) / 7) * 100}% - ${(before ? 0 : 3) + (after ? 0 : 3)}px)`,
          };
          return isWholeDays(p.item, p.to > p.from || before || after) ? (
            <p
              key={i}
              className={cn(
                "absolute truncate px-1.5 text-[12px] font-medium leading-[17px]",
                !before && "rounded-l-[4px]",
                !after && "rounded-r-[4px]",
              )}
              style={{
                ...position,
                background: `rgb(${tint(rgb, dark)})`,
                color: `rgb(${shade(rgb, dark)})`,
              }}
            >
              {p.item.label}
            </p>
          ) : (
            <p
              key={i}
              className="absolute flex items-center gap-1.5 px-1.5 text-[12px] leading-[17px] text-foreground"
              style={position}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: `rgb(${rgb})` }}
              />
              <span className="min-w-0 flex-1 truncate">{p.item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatTime(new Date(p.item.start).toISOString(), TZ)}
              </span>
            </p>
          );
        })}
        {hidden.map(
          (n, c) =>
            n > 0 && (
              <span
                key={c}
                className="absolute bottom-0.5 px-2 text-[11px] text-muted-foreground"
                style={{ left: `${(c / 7) * 100}%`, width: `${100 / 7}%` }}
              >
                {t.calendarView.more(n)}
              </span>
            ),
        )}
      </div>
    </div>
  );
});
