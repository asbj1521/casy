import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { useSignedInUser } from "@/context/auth";
import { useLang, useT } from "@/i18n/lang";
import {
  calendarColors,
  dayKey,
  HOLIDAY_CALENDAR_ID,
  holidaySegmentsByDay,
  segmentByDay,
  withHolidays,
  type DaySegment,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import type { GridItem } from "@/lib/monthGrid";
import { APP_TIME_ZONE } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Grey, for a block whose calendar is somehow missing from the list (as on My calendar). */
const FALLBACK_RGB = "113, 113, 122";

const NO_CALENDARS: OverviewCalendar[] = [];

export interface MyCalendarDays {
  /** Still fetching your calendars. */
  loading: boolean;
  /** No calendar connected at all: there is nothing to show, said as such. */
  none: boolean;
  /** The day containing `date`, as day segments, holidays first. */
  segmentsOn: (date: Date) => DaySegment[];
  /** "r, g, b" for a calendar, as My calendar colours it. */
  colorOf: (calendarId: string) => string;
  /** What to call a segment: its calendar's name, or the holiday's. */
  labelOf: (segment: DaySegment) => string;
  /**
   * Everything over the year searched as whole blocks rather than day by
   * day, named, holidays included: what the month view lays out
   * (lib/monthGrid.ts), where something lasting days is one bar.
   */
  items: GridItem[];
  /** Every calendar with its tick and settings, for the list of calendars. */
  calendars: OverviewCalendar[];
  /** Why they couldn't be fetched, if they couldn't. */
  error: Error | null;
  retry: () => void;
  /** The server stopped early because there was too much busy time. */
  truncated: boolean;
}

/**
 * Your own calendar day by day, for the swipe screen (#74): the calendars
 * that count (as on My calendar, unticked ones left out) over the whole
 * year searched, with the Danish holidays. The same query My events' clash
 * check and badge read, so it is usually cached already. Only busy times and
 * calendar names: Casy stores no event titles.
 */
export function useMyCalendarDays(): MyCalendarDays {
  const userId = useSignedInUser().id;
  const t = useT();
  const { lang } = useLang();
  const { data, isPending, error, refetch } = useQuery(
    calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
  );

  const counted = useMemo(() => {
    const included = new Set(data?.calendars.filter((c) => c.included).map((c) => c.id));
    return (data?.blocks ?? []).filter((b) => included.has(b.calendarId));
  }, [data]);
  const holidays = useMemo(
    () => holidaySegmentsByDay(new Date(SEARCH_WINDOW.start), new Date(SEARCH_WINDOW.end), TZ),
    [],
  );
  const byDay = useMemo(
    () =>
      withHolidays(
        segmentByDay(counted, new Date(SEARCH_WINDOW.start), new Date(SEARCH_WINDOW.end), TZ),
        holidays,
      ),
    [counted, holidays],
  );
  const palette = useMemo(() => calendarColors(data?.calendars ?? []), [data]);
  const names = useMemo(() => new Map((data?.calendars ?? []).map((c) => [c.id, c.name])), [data]);
  const items = useMemo(
    (): GridItem[] => [
      ...[...holidays.values()].flat().map((s) => ({
        calendarId: s.calendarId,
        start: s.start.getTime(),
        end: s.end.getTime(),
        label: s.holiday ? (lang === "da" ? s.holiday.name : s.holiday.englishName) : "",
      })),
      ...counted.map((b) => ({
        calendarId: b.calendarId,
        start: Date.parse(b.start),
        end: Date.parse(b.end),
        label: names.get(b.calendarId) ?? "",
      })),
    ],
    [counted, holidays, names, lang],
  );

  const segmentsOn = useCallback((date: Date) => byDay.get(dayKey(date, TZ)) ?? [], [byDay]);
  const colorOf = useCallback((id: string) => palette.get(id) ?? FALLBACK_RGB, [palette]);
  const labelOf = useCallback(
    (s: DaySegment) =>
      s.holiday
        ? lang === "da"
          ? s.holiday.name
          : s.holiday.englishName
        : s.calendarId === HOLIDAY_CALENDAR_ID
          ? t.calendarView.holidayCalendar
          : (names.get(s.calendarId) ?? ""),
    [lang, names, t],
  );
  const retry = useCallback(() => void refetch(), [refetch]);

  // One object that changes only when something in it does, so a screen
  // drawing a lot from it (the month view) isn't redrawn by every render.
  return useMemo(
    () => ({
      loading: isPending,
      none: !!data && data.calendars.length === 0,
      segmentsOn,
      colorOf,
      labelOf,
      items,
      calendars: data?.calendars ?? NO_CALENDARS,
      error,
      retry,
      truncated: !!data?.truncated,
    }),
    [isPending, data, segmentsOn, colorOf, labelOf, items, error, retry],
  );
}
