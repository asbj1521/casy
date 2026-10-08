import { Fragment, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";

import { calendarBusyQuery } from "@/api/calendars";
import { DayRow } from "@/components/calendarView/DayRow";
import PhoneCalendar from "@/components/calendarView/PhoneCalendar";
import CalendarListPanel from "@/components/CalendarListPanel";
import TopNav from "@/components/TopNav";
import DanishTimeNote from "@/components/time/DanishTimeNote";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useCalendarVisibility } from "@/hooks/useCalendarVisibility";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import type { Messages } from "@/i18n/da";
import { LOCALE, useLang, useT, type Lang } from "@/i18n/lang";
import {
  buildMonthLayout,
  calendarColors,
  dayKey,
  formatSegmentRange,
  HOLIDAY_CALENDAR,
  holidayName,
  holidaysInYearAhead,
  holidaySegmentsByDay,
  segmentByDay,
  withHolidays,
  type DaySegment,
} from "@/lib/calendarOverview";
import { cn } from "@/lib/utils";
import { APP_TIME_ZONE, localDate } from "@/lib/zone";

/**
 * The zone every day and time on this page is in: Danish time, the same as
 * the scheduling page, whatever zone the browser is in.
 */
const TZ = APP_TIME_ZONE;

/** This month in Danish time, 0-based. */
function thisMonth(): { year: number; month: number } {
  const { year, month } = localDate(Date.now(), TZ);
  return { year, month };
}

/** "Tue 22 Sept 2026, 2 busy blocks" plus any holiday names, for screen readers and tests. */
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

/** Zinc, for a block whose calendar is somehow missing from the list. */
const FALLBACK_RGB = "113, 113, 122";

/** A narrow week-number column, then seven equal day columns. */
// No week-number column on a phone: the seven days need every pixel.
const GRID_COLUMNS = "grid grid-cols-7 sm:grid-cols-[2.75rem_repeat(7,minmax(0,1fr))]";

/** Rows shown inside a day cell before collapsing the rest into "+N more". */
const MAX_ROWS_PER_CELL = 3;

/**
 * My calendar: the signed-in person's own busy time as a month grid, and the
 * list of their calendars with the settings that decide how each one counts.
 *
 * What's shown is exactly what Casy stores: busy time ranges plus the
 * calendar (and account) each came from, coloured by the category its owner
 * gave that calendar. There are no event titles, since none are ever stored
 * (see the calendar_integrations migration). Overlapping and back-to-back
 * events are merged into one busy block when synced, so a run of consecutive
 * lectures appears as a single block.
 */
function ComputerCalendar() {
  const user = useSignedInUser();
  const t = useT();
  const { lang } = useLang();
  const calendarsHome = useCalendarsHome();
  const [month, setMonth] = useState(thisMonth);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { holidaysHidden, setCalendarsVisible, error: visibilityError } = useCalendarVisibility();

  const layout = useMemo(
    () => buildMonthLayout(month.year, month.month, TZ, LOCALE[lang]),
    [month, lang],
  );
  const gridDays = useMemo(() => layout.weeks.flat(), [layout]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    ...calendarBusyQuery(user.id, layout.from.toISOString(), layout.to.toISOString()),
    placeholderData: keepPreviousData, // no flash of emptiness when changing month
  });

  const connected = useMemo(() => data?.calendars ?? [], [data]);
  // The built-in holiday calendar is always present, ahead of the connected
  // ones, named in the page's language.
  const holidayCount = useMemo(() => holidaysInYearAhead(TZ), []);
  const calendars = useMemo(
    () => [
      {
        ...HOLIDAY_CALENDAR,
        name: t.calendarView.holidayCalendar,
        total: holidayCount,
        included: !holidaysHidden,
      },
      ...connected,
    ],
    [connected, t, holidayCount, holidaysHidden],
  );
  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const palette = useMemo(() => calendarColors(connected), [connected]);
  // Every lookup wants the same fallback, so ask through one function instead
  // of repeating the grey at each call site.
  const colorOf = useCallback(
    (calendarId: string) => palette.get(calendarId) ?? FALLBACK_RGB,
    [palette],
  );
  const segmentsByDay = useMemo(
    () =>
      withHolidays(
        segmentByDay(
          // Unticked calendars drop out; a block whose calendar is somehow missing
          // from the list still shows, in grey (FALLBACK_RGB).
          (data?.blocks ?? []).filter((b) => calendarById.get(b.calendarId)?.included !== false),
          layout.from,
          layout.to,
          TZ,
        ),
        holidaysHidden ? new Map() : holidaySegmentsByDay(layout.from, layout.to, TZ),
      ),
    [data, calendarById, layout, holidaysHidden],
  );

  const todayKey = dayKey(new Date(), TZ);
  const inMonthKeys = gridDays.filter((d) => d.inMonth).map((d) => d.key);
  const selected =
    selectedKey && gridDays.some((d) => d.key === selectedKey)
      ? selectedKey
      : inMonthKeys.includes(todayKey)
        ? todayKey
        : inMonthKeys[0];
  const selectedDay = gridDays.find((d) => d.key === selected);
  const selectedSegments = segmentsByDay.get(selected) ?? [];

  const shiftMonth = (delta: number) => {
    setSelectedKey(null);
    setMonth(({ year, month: m }) => {
      // Date.UTC rolls month 12 over into next January, with no clock involved.
      const d = new Date(Date.UTC(year, m + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };
  const goToday = () => {
    setSelectedKey(dayKey(new Date(), TZ));
    setMonth(thisMonth());
  };
  const noConnectedCalendars = !isLoading && !error && connected.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/* No "back" link: the header is how every page is reached. */}
      <main className="px-4 pb-20 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.calendarView.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.calendarView.intro}</p>
        <DanishTimeNote className="mt-1" />

        {error && (
          <Notice tone="error" className="mt-6">
            <div className="flex items-start justify-between gap-2">
              {error.message}
              <button
                type="button"
                onClick={() => void refetch()}
                className="shrink-0 font-medium underline underline-offset-2"
              >
                {t.calendarView.tryAgain}
              </button>
            </div>
          </Notice>
        )}

        {data?.truncated && (
          <Notice tone="warning" icon={Info} className="mt-6">
            {t.calendarView.truncated}
          </Notice>
        )}

        {noConnectedCalendars && (
          <Notice tone="info" className="mt-6">
            {t.calendarView.noCalendars(
              <Link
                to={calendarsHome.to}
                className="font-medium text-foreground underline underline-offset-2"
              >
                {t.calendarView.noCalendarsLink}
              </Link>,
            )}
          </Notice>
        )}

        {/* One grid: the calendar list on the left, as on My groups, its top
            level with the month's header (row 1); the grid box is row 2 and the
            day box row 3. The list runs on into an empty last row (1fr) that
            takes whatever height it needs beyond the month and day boxes;
            without it, opening part of the list stretched the month's rows and
            pushed the day box down. Narrower screens stack the month first, in
            the order of the markup. */}
        <div className="mt-6 grid items-start gap-x-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:grid-rows-[auto_auto_auto_1fr]">
          <div className="mb-3 flex min-w-0 items-center justify-between lg:col-start-2 lg:row-start-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold capitalize text-foreground">
              {layout.label}
              {(isLoading || isFetching) && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={goToday}
                className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                {t.calendarView.today}
              </button>
              <button
                onClick={() => shiftMonth(-1)}
                aria-label={t.common.previousMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                aria-label={t.common.nextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border bg-card lg:col-start-2 lg:row-start-2">
            <div className={cn(GRID_COLUMNS, "border-b bg-secondary/40")}>
              <div
                className="hidden px-1 py-2 text-center text-xs font-medium text-muted-foreground sm:block"
                title={t.calendarView.weekNumber}
              >
                {t.calendarView.weekHeader}
              </div>
              {layout.weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="px-0.5 py-2 text-center text-[11px] font-medium text-muted-foreground sm:px-2 sm:text-left sm:text-xs"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className={GRID_COLUMNS}>
              {gridDays.map((cell, index) => {
                const isToday = cell.key === todayKey;
                const isPast = cell.inMonth && cell.key < todayKey;
                const isSelected = cell.key === selected;
                const segments = segmentsByDay.get(cell.key) ?? [];
                const shown = segments.slice(0, MAX_ROWS_PER_CELL);
                const extra = segments.length - shown.length;
                // The 1st of a month is labelled with its abbreviation, e.g. "1. okt.".
                const numberLabel =
                  cell.dayOfMonth === 1
                    ? cell.date.toLocaleDateString(LOCALE[lang], {
                        day: "numeric",
                        month: "short",
                        timeZone: TZ,
                      })
                    : cell.dayOfMonth;

                // Each row starts with its ISO week number, on the left of Monday.
                const rowIndex = Math.floor(index / 7);
                const isCurrentWeek = layout.weeks[rowIndex].some((d) => d.key === todayKey);

                return (
                  <Fragment key={cell.key}>
                    {index % 7 === 0 && (
                      <div
                        title={t.calendarView.week(layout.weekNumbers[rowIndex])}
                        className={cn(
                          "hidden items-start justify-center border-b border-r bg-secondary/40 pt-2.5 text-xs text-muted-foreground sm:flex",
                          isCurrentWeek && "font-semibold text-foreground",
                        )}
                      >
                        {layout.weekNumbers[rowIndex]}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedKey(cell.key)}
                      aria-label={cellLabel(cell.date, segments, t, lang)}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative flex min-h-[60px] flex-col border-b border-r p-1 text-left transition hover:bg-secondary/40 sm:min-h-[104px] sm:p-1.5",
                        isSelected && "ring-2 ring-inset ring-primary/60",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 min-w-6 items-center justify-center self-center rounded-full px-1 text-xs sm:self-start",
                          !cell.inMonth && "text-muted-foreground/40",
                          cell.inMonth && isPast && "text-muted-foreground",
                          cell.inMonth && !isPast && !isToday && "text-foreground",
                          isToday && "bg-primary font-semibold text-primary-foreground",
                        )}
                      >
                        <span className="sm:hidden">{cell.dayOfMonth}</span>
                        <span className="hidden sm:inline">{numberLabel}</span>
                      </span>

                      {/* A phone cell only fits a dot per block, in its
                          calendar's colour; tapping the day lists them below. */}
                      {segments.length > 0 && (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
                          {segments.slice(0, 4).map((seg, i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: `rgb(${colorOf(seg.calendarId)})` }}
                            />
                          ))}
                          {segments.length > 4 && (
                            <span className="text-[9px] leading-none text-muted-foreground">+</span>
                          )}
                        </div>
                      )}

                      <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                        {shown.map((seg, i) => {
                          const rgb = colorOf(seg.calendarId);
                          const cal = calendarById.get(seg.calendarId);
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1 rounded-[4px] px-1 py-0.5 text-[10px] leading-tight"
                              style={{ backgroundColor: `rgba(${rgb}, 0.16)` }}
                            >
                              <span
                                className="h-3 w-[3px] shrink-0 rounded-full"
                                style={{ backgroundColor: `rgb(${rgb})` }}
                              />
                              <span className="truncate text-foreground/80">
                                {seg.holiday ? (
                                  <span className="font-medium">
                                    {holidayName(seg.holiday, lang)}
                                  </span>
                                ) : (
                                  <>
                                    <span className="font-medium">
                                      {formatSegmentRange(seg, TZ, t.calendarView.allDay)}
                                    </span>{" "}
                                    {cal?.name}
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                        {extra > 0 && (
                          <span className="px-1 text-[10px] text-muted-foreground">
                            {t.calendarView.more(extra)}
                          </span>
                        )}
                      </div>

                      {/* Past days keep their colour under a grey veil. */}
                      {isPast && (
                        <div className="pointer-events-none absolute inset-0 bg-zinc-400/35" />
                      )}
                    </button>
                  </Fragment>
                );
              })}
            </div>
          </div>

          <section className="mt-4 min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:mt-6 sm:p-5 lg:col-start-2 lg:row-start-3">
            <h3 className="font-semibold text-foreground">
              {selectedDay?.date.toLocaleDateString(LOCALE[lang], {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: TZ,
              })}
            </h3>
            {selectedSegments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t.calendarView.nothingBusy}</p>
            ) : (
              <ul className="mt-3 divide-y">
                {selectedSegments.map((seg, i) => (
                  <DayRow
                    key={i}
                    seg={seg}
                    calendar={calendarById.get(seg.calendarId)}
                    rgb={colorOf(seg.calendarId)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Scrolls with the page rather than on its own: a box scrolling by
              itself cut its content off at the month grid's top line. */}
          <div className="mt-6 min-w-0 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:mt-0">
            {/* Connecting calendars is a page of its own (CalendarAccounts). */}
            <ListGroup className="mb-4 mt-0">
              <ListRow
                to={calendarsHome.to}
                icon={CalendarPlus}
                label={t.calendarAccounts.row}
                detail={t.calendarAccounts.rowDetail}
                value={isLoading ? null : connected.length}
              />
            </ListGroup>
            <CalendarListPanel
              calendars={calendars}
              colorOf={colorOf}
              onSetVisible={setCalendarsVisible}
              visibilityError={visibilityError}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * My calendar: a phone gets the month drawn like Apple Calendar's
 * (PhoneCalendar), a computer the grid with its calendar list beside it.
 */
export default function CalendarOverview() {
  return usePhoneLayout() ? <PhoneCalendar /> : <ComputerCalendar />;
}
