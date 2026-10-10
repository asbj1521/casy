import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { calendarBusyQuery } from "@/api/calendars";
import { useSignedInUser } from "@/context/auth";
import { syncPhone } from "@/hooks/usePhoneCalendarSync";
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
import { isNativeApp } from "@/lib/nativeApp";
import {
  onPhoneCalendarChange,
  phoneConnectionId,
  readPhoneEventDetails,
} from "@/lib/phoneCalendar";
import { phoneCalendarIds, withPhoneEvents } from "@/lib/phoneEvents";
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
 *
 * In the iPhone app, this phone's own calendars are drawn from the phone
 * instead (#110): each event on its own, named by its title, with its place
 * and notes (phoneEvents.ts). They are read here and never leave the phone.
 *
 * In the iPhone app the phone's calendars are sent again as this opens, so
 * the days under a date you are answering are the phone's as they are now,
 * not as they were when the app last sent them (the copy is refetched once
 * the send lands).
 */
export function useMyCalendarDays(): MyCalendarDays {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isNativeApp || !phoneConnectionId(userId)) return;
    syncPhone(queryClient, userId, { create: false }).catch((err) =>
      console.warn("sending the phone's calendars failed", err),
    );
  }, [queryClient, userId]);
  const t = useT();
  const { lang } = useLang();
  const { data, isPending, error, refetch } = useQuery(
    calendarBusyQuery(userId, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
  );

  // This phone's events with their titles, read on the phone (the app only).
  // Not in the persisted queries (queryPersistence.ts), so never written to
  // storage either; read again whenever the phone's calendars change.
  const phoneConnection = isNativeApp ? phoneConnectionId(userId) : null;
  const { data: phoneEvents } = useQuery({
    queryKey: ["phone-event-details", userId],
    queryFn: () =>
      readPhoneEventDetails(Date.parse(SEARCH_WINDOW.start), Date.parse(SEARCH_WINDOW.end)),
    enabled: !!phoneConnection,
    staleTime: 30_000,
    // An app build without readDetails: the blocks as the server has them.
    retry: false,
  });
  useEffect(() => {
    if (!phoneConnection) return;
    let stop: (() => void) | undefined;
    let gone = false;
    onPhoneCalendarChange(
      () => void queryClient.invalidateQueries({ queryKey: ["phone-event-details", userId] }),
    )
      .then((remove) => (gone ? remove() : (stop = remove)))
      .catch((err) => console.warn("watching the phone's calendars failed", err));
    return () => {
      gone = true;
      stop?.();
    };
  }, [phoneConnection, queryClient, userId]);

  const counted = useMemo(() => {
    const included = new Set(data?.calendars.filter((c) => c.included).map((c) => c.id));
    const blocks =
      data && phoneConnection && phoneEvents
        ? withPhoneEvents(
            data.blocks,
            phoneEvents,
            phoneCalendarIds(data.calendars, phoneConnection),
            { from: Date.parse(SEARCH_WINDOW.start), to: Date.parse(SEARCH_WINDOW.end) },
          )
        : (data?.blocks ?? []);
    return blocks.filter((b) => included.has(b.calendarId));
  }, [data, phoneConnection, phoneEvents]);
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
        label: b.details?.title || (names.get(b.calendarId) ?? ""),
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
          : s.details?.title || (names.get(s.calendarId) ?? ""),
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
