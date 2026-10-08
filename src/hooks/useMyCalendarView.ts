import { useMemo } from "react";

import { useCalendarVisibility } from "@/hooks/useCalendarVisibility";
import { useMyCalendarDays, type MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useT } from "@/i18n/lang";
import {
  HOLIDAY_CALENDAR,
  HOLIDAY_CALENDAR_ID,
  holidaysInYearAhead,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { APP_TIME_ZONE } from "@/lib/zone";

/**
 * What My calendar draws (#104), on a phone and a computer alike: your
 * calendar over the year searched (useMyCalendarDays), less the holidays when
 * their tick is off, and the list of calendars with the built-in holidays
 * first, named in the page's language, with the ticks that change them.
 */
export function useMyCalendarView() {
  const t = useT();
  const mine = useMyCalendarDays();
  const { holidaysHidden, setCalendarsVisible, error } = useCalendarVisibility();

  // The holiday calendar's tick only hides it here.
  const calendar = useMemo(
    (): MyCalendarDays => ({
      ...mine,
      items: holidaysHidden
        ? mine.items.filter((i) => i.calendarId !== HOLIDAY_CALENDAR_ID)
        : mine.items,
      segmentsOn: (date: Date) =>
        mine
          .segmentsOn(date)
          .filter((s) => !(holidaysHidden && s.calendarId === HOLIDAY_CALENDAR_ID)),
    }),
    [mine, holidaysHidden],
  );
  // Its total counts the year ahead, the range the connected calendars are synced for.
  const holidayCount = useMemo(() => holidaysInYearAhead(APP_TIME_ZONE), []);
  const calendars = useMemo(
    (): OverviewCalendar[] => [
      {
        ...HOLIDAY_CALENDAR,
        name: t.calendarView.holidayCalendar,
        total: holidayCount,
        included: !holidaysHidden,
      },
      ...mine.calendars,
    ],
    [mine.calendars, t, holidayCount, holidaysHidden],
  );
  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  return {
    calendar,
    calendars,
    calendarById,
    /** Only the connected ones, without the built-in holidays. */
    connectedCount: mine.calendars.length,
    setCalendarsVisible,
    visibilityError: error,
  };
}
