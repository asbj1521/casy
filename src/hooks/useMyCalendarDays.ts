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
} from "@/lib/calendarOverview";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { APP_TIME_ZONE } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** Grey, for a block whose calendar is somehow missing from the list (as on My calendar). */
const FALLBACK_RGB = "113, 113, 122";

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
  const { data, isPending } = useQuery(
    calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
  );

  const byDay = useMemo(() => {
    const from = new Date(SEARCH_WINDOW.start);
    const to = new Date(SEARCH_WINDOW.end);
    const included = new Set(data?.calendars.filter((c) => c.included).map((c) => c.id));
    return withHolidays(
      segmentByDay(
        (data?.blocks ?? []).filter((b) => included.has(b.calendarId)),
        from,
        to,
        TZ,
      ),
      holidaySegmentsByDay(from, to, TZ),
    );
  }, [data]);
  const palette = useMemo(() => calendarColors(data?.calendars ?? []), [data]);
  const names = useMemo(() => new Map((data?.calendars ?? []).map((c) => [c.id, c.name])), [data]);

  return {
    loading: isPending,
    none: !!data && data.calendars.length === 0,
    segmentsOn: useCallback((date: Date) => byDay.get(dayKey(date, TZ)) ?? [], [byDay]),
    colorOf: useCallback((id: string) => palette.get(id) ?? FALLBACK_RGB, [palette]),
    labelOf: useCallback(
      (s: DaySegment) =>
        s.holiday
          ? lang === "da"
            ? s.holiday.name
            : s.holiday.englishName
          : s.calendarId === HOLIDAY_CALENDAR_ID
            ? t.calendarView.holidayCalendar
            : (names.get(s.calendarId) ?? ""),
      [lang, names, t],
    ),
  };
}
