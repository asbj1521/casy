import { Fragment, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";

import {
  calendarBusyQuery,
  calendarsChanged,
  primaryCalendarQuery,
  updateCalendar,
  updatePrimaryCalendar,
  type CalendarChange,
} from "@/api/calendars";
import CalendarListPanel from "@/components/CalendarListPanel";
import TopNav from "@/components/TopNav";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import type { Messages } from "@/i18n/da";
import { LOCALE, useLang, useT, type Lang } from "@/i18n/lang";
import {
  buildMonthLayout,
  calendarColors,
  dayKey,
  formatDuration,
  formatSegmentRange,
  HOLIDAY_CALENDAR,
  HOLIDAY_CALENDAR_ID,
  holidaySegmentsByDay,
  segmentByDay,
  withHolidays,
  type DaySegment,
  type OverviewCalendar,
  type OverviewData,
} from "@/lib/calendarOverview";
import { readStored, writeStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** A holiday's name in the page's language. */
function holidayName(holiday: NonNullable<DaySegment["holiday"]>, lang: Lang): string {
  return lang === "da" ? holiday.name : holiday.englishName;
}

/** A calendar's name; the built-in holiday calendar is named in the page's language. */
function calendarName(calendar: OverviewCalendar, t: Messages): string {
  return calendar.id === HOLIDAY_CALENDAR_ID ? t.calendarView.holidayCalendar : calendar.name;
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
 * Whether the built-in holiday calendar is ticked. It has no row in the
 * database and never counts when scheduling (a holiday isn't busy time), so
 * its tick is only a view setting, remembered in this browser.
 */
const HOLIDAYS_HIDDEN_KEY = "casy-hide-holidays";

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
export default function CalendarOverview() {
  const queryClient = useQueryClient();
  const user = useSignedInUser();
  const t = useT();
  const { lang } = useLang();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [holidaysHidden, setHolidaysHidden] = useState(
    () => readStored(HOLIDAYS_HIDDEN_KEY) === "1",
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [askingPrimaryId, setAskingPrimaryId] = useState<string | null>(null);

  const layout = useMemo(
    () => buildMonthLayout(month.year, month.month, LOCALE[lang]),
    [month, lang],
  );
  const gridDays = useMemo(() => layout.weeks.flat(), [layout]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    ...calendarBusyQuery(user.id, layout.from.toISOString(), layout.to.toISOString()),
    placeholderData: keepPreviousData, // no flash of emptiness when changing month
  });

  // One calendar's category or priority.
  const setLabels = useMutation({
    mutationFn: ({ calendarId, change }: { calendarId: string; change: CalendarChange }) =>
      updateCalendar(calendarId, change),
    onSuccess: () => calendarsChanged(queryClient),
  });

  // A calendar's own name, or null to go back to the provider's. The editor
  // stays open until the new name is saved, so a failure shows beside it.
  const rename = useMutation({
    mutationFn: ({ calendarId, name }: { calendarId: string; name: string | null }) =>
      updateCalendar(calendarId, { name }),
    onSuccess: async () => {
      await calendarsChanged(queryClient);
      setRenamingId(null);
    },
  });

  // The primary calendar: shown here, changed only after a second "yes".
  const { data: primary } = useQuery(primaryCalendarQuery(user.id));
  const setPrimary = useMutation({
    mutationFn: (calendarId: string) => updatePrimaryCalendar(queryClient, user.id, { calendarId }),
    onSuccess: () => setAskingPrimaryId(null),
  });

  // Tick or untick calendars: whether they count at all, saved on the
  // server. The tick moves at once (the cached answer is patched before the
  // call) and moves back if saving fails.
  const setIncluded = useMutation({
    mutationFn: async ({ ids, included }: { ids: string[]; included: boolean }) => {
      await Promise.all(ids.map((calendarId) => updateCalendar(calendarId, { included })));
    },
    onMutate: async ({ ids, included }) => {
      // Both this page and the scheduling page's copy of your calendars.
      const key = { queryKey: ["calendar-busy"] };
      await queryClient.cancelQueries(key);
      const previous = queryClient.getQueriesData<OverviewData>(key);
      queryClient.setQueriesData<OverviewData>(key, (old) =>
        old
          ? {
              ...old,
              calendars: old.calendars.map((c) => (ids.includes(c.id) ? { ...c, included } : c)),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _v, context) => {
      for (const [queryKey, old] of context?.previous ?? [])
        queryClient.setQueryData(queryKey, old);
    },
    onSettled: () => calendarsChanged(queryClient),
  });

  const calendars = useMemo(() => data?.calendars ?? [], [data]);
  // Unticked: calendars that don't count, plus the holidays if you hid them.
  const hidden = useMemo(
    () =>
      new Set([
        ...calendars.filter((c) => c.included === false).map((c) => c.id),
        ...(holidaysHidden ? [HOLIDAY_CALENDAR_ID] : []),
      ]),
    [calendars, holidaysHidden],
  );
  // The built-in holiday calendar is always present, ahead of the connected ones.
  const allCalendars = useMemo(() => [HOLIDAY_CALENDAR, ...calendars], [calendars]);
  const calendarById = useMemo(() => new Map(allCalendars.map((c) => [c.id, c])), [allCalendars]);
  const palette = useMemo(() => calendarColors(calendars), [calendars]);
  // Every lookup wants the same fallback, so ask through one function instead
  // of repeating the grey at each call site.
  const colorOf = useCallback(
    (calendarId: string) => palette.get(calendarId) ?? FALLBACK_RGB,
    [palette],
  );
  const holidaysByDay = useMemo(() => holidaySegmentsByDay(layout.from, layout.to), [layout]);
  // Each calendar's total, not just the month on screen. Holidays count over
  // the year ahead, the same range the connected calendars are synced for.
  const blockCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of calendars) if (c.total !== undefined) counts.set(c.id, c.total);
    const today = new Date();
    const yearAhead = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    counts.set(
      HOLIDAY_CALENDAR_ID,
      [...holidaySegmentsByDay(today, yearAhead).values()].reduce(
        (sum, list) => sum + list.length,
        0,
      ),
    );
    return counts;
  }, [calendars]);
  const segmentsByDay = useMemo(
    () =>
      withHolidays(
        segmentByDay(
          (data?.blocks ?? []).filter((b) => !hidden.has(b.calendarId)),
          layout.from,
          layout.to,
        ),
        hidden.has(HOLIDAY_CALENDAR_ID) ? new Map() : holidaysByDay,
      ),
    [data, hidden, layout, holidaysByDay],
  );

  const todayKey = dayKey(new Date());
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
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };
  const goToday = () => {
    const now = new Date();
    setSelectedKey(dayKey(now));
    setMonth({ year: now.getFullYear(), month: now.getMonth() });
  };
  // Tick or untick any number of calendars at once: one, or a whole brand
  // group. Holidays stay in this browser; everything else is saved.
  const setCalendarsVisible = (ids: string[], visible: boolean) => {
    if (ids.includes(HOLIDAY_CALENDAR_ID)) {
      setHolidaysHidden(!visible);
      writeStored(HOLIDAYS_HIDDEN_KEY, visible ? null : "1");
    }
    const connected = ids.filter((id) => id !== HOLIDAY_CALENDAR_ID);
    if (connected.length > 0) setIncluded.mutate({ ids: connected, included: visible });
  };

  const noConnectedCalendars = !isLoading && !error && calendars.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      {/* No "back" link: the header is how every page is reached. */}
      <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        {error && (
          <Notice tone="error" className="mb-4">
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
          <Notice tone="warning" icon={Info} className="mb-4">
            {t.calendarView.truncated}
          </Notice>
        )}

        {noConnectedCalendars && (
          <Notice tone="info" className="mb-4">
            {t.calendarView.noCalendars(
              <Link
                to="/profile"
                className="font-medium text-foreground underline underline-offset-2"
              >
                {t.calendarView.noCalendarsLink}
              </Link>,
            )}
          </Notice>
        )}

        {/* One grid, so the calendar list's top lines up with the month grid's:
            the month header is row 1, the grid box and the list start on row 2.
            The list runs on into an empty last row (1fr) that takes whatever
            height it needs beyond the month and day boxes; without it, opening
            part of the list stretched the month's row and pushed the day box down. */}
        <div className="grid items-start gap-x-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_auto_1fr]">
          <div className="mb-3 flex min-w-0 items-center justify-between lg:col-start-1 lg:row-start-1">
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

          <div className="min-w-0 overflow-hidden rounded-xl border bg-card lg:col-start-1 lg:row-start-2">
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
                    ? cell.date.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" })
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
                                      {formatSegmentRange(seg, t.calendarView.allDay)}
                                    </span>{" "}
                                    {cal && calendarName(cal, t)}
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

          <section className="mt-4 min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:mt-6 sm:p-5 lg:col-start-1 lg:row-start-3">
            <h3 className="font-semibold text-foreground">
              {selectedDay?.date.toLocaleDateString(LOCALE[lang], {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
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
          <div className="mt-6 lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:mt-0">
            <CalendarListPanel
              calendars={allCalendars}
              hidden={hidden}
              blockCounts={blockCounts}
              colorOf={colorOf}
              savingId={setLabels.isPending ? setLabels.variables.calendarId : null}
              saveError={(setLabels.error ?? setIncluded.error)?.message ?? null}
              onSetVisible={setCalendarsVisible}
              onSetPurpose={(calendarId, purpose) =>
                setLabels.mutate({ calendarId, change: { purpose } })
              }
              onSetPriority={(calendarId, priority) =>
                setLabels.mutate({ calendarId, change: { priority } })
              }
              renamingId={renamingId}
              renameSubmitting={rename.isPending}
              renameError={rename.error?.message ?? null}
              onStartRename={(calendarId) => {
                rename.reset();
                setRenamingId(calendarId);
              }}
              onCancelRename={() => setRenamingId(null)}
              onRename={(calendarId, name) => rename.mutate({ calendarId, name })}
              primaryId={primary?.calendarId ?? null}
              askingPrimaryId={askingPrimaryId}
              primaryBusy={setPrimary.isPending}
              primaryError={setPrimary.error?.message ?? null}
              onAskPrimary={(calendarId) => {
                setPrimary.reset();
                setAskingPrimaryId(calendarId);
              }}
              onCancelPrimary={() => setAskingPrimaryId(null)}
              onConfirmPrimary={(calendarId) => setPrimary.mutate(calendarId)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * One row in the selected day's list. Holidays and busy blocks differ only in
 * what the two lines of text say and which pill sits on the right, so they
 * share the row rather than duplicating its frame.
 */
function DayRow({
  seg,
  calendar,
  rgb,
}: {
  seg: DaySegment;
  calendar: OverviewCalendar | undefined;
  rgb: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const holiday = seg.holiday;
  const words = t.calendarView;

  // A holiday shows its name in the page's language, with the other
  // language's name beside it.
  const title = holiday ? holidayName(holiday, lang) : formatSegmentRange(seg, words.allDay);
  const aside = holiday
    ? holidayName(holiday, lang === "da" ? "en" : "da")
    : seg.allDay
      ? ""
      : formatDuration(seg.start, seg.end, words.hourUnit);
  const source = holiday
    ? `${holiday.kind === "public" ? words.publicHoliday : words.observedDay} · ${words.denmark}`
    : [
        calendar ? calendarName(calendar, t) : words.calendarFallback,
        calendar?.account,
        calendar && words.providerNames[calendar.provider],
      ]
        .filter(Boolean)
        .join(" · ");
  const pill = holiday
    ? words.holidayCategory
    : calendar?.purpose
      ? t.categories[calendar.purpose]
      : words.noCategory;

  return (
    <li className="flex items-start gap-3 py-3 text-sm">
      <span
        className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: `rgb(${rgb})` }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          {title}
          {aside && <span className="ml-2 font-normal text-muted-foreground">{aside}</span>}
        </p>
        <p className="text-muted-foreground">{source}</p>
        {!holiday && (seg.continuesBefore || seg.continuesAfter) && (
          <p className="text-xs text-muted-foreground">
            {seg.continuesBefore && seg.continuesAfter
              ? words.continuesBoth
              : seg.continuesBefore
                ? words.continuesBefore
                : words.continuesAfter}
          </p>
        )}
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-xs"
        style={{ backgroundColor: `rgba(${rgb}, 0.16)`, color: `rgb(${rgb})` }}
      >
        {pill}
      </span>
    </li>
  );
}
