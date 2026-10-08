import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { formatSegmentRange } from "@/lib/calendarOverview";
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/**
 * The first thing in your own calendar the date runs into, and how many more:
 * for a meeting, anything during it; for a trip or holiday, anything on its
 * days. Holidays aren't counted: the search already keeps clear of the ones
 * nobody is free on.
 */
export function clashesOn(date: { start: string; end: string }, calendar: MyCalendarDays) {
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const hits = [];
  for (let day = startOfDay(start, TZ); day < end; day = addDays(day, 1, TZ)) {
    for (const s of calendar.segmentsOn(new Date(day))) {
      if (!s.holiday && s.start.getTime() < end && s.end.getTime() > start) hits.push(s);
    }
  }
  if (hits.length === 0) return null;
  return {
    label: calendar.labelOf(hits[0]),
    when: formatSegmentRange(hits[0], TZ, ""),
    more: hits.length - 1,
  };
}
