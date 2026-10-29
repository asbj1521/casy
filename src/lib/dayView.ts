/**
 * The home page's day view (#176): the day in the address (`?day=2026-10-29`,
 * Danish time), and Casy's own events (agreed dates, trips) as blocks of a
 * day like your calendars' own, so the day view draws and taps them alike.
 */
import { dayKey, type DaySegment } from "@/lib/calendarOverview";
import { addDays, APP_TIME_ZONE, localDate, wallTime } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** "2026-10-29" for a local midnight. */
export function dayParam(midnight: number): string {
  return dayKey(new Date(midnight), TZ);
}

/** The local midnight a `?day=` names, or null for anything that isn't a real day. */
export function parseDayParam(value: string | null): number | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const midnight = wallTime(year, month, day, 0, TZ);
  // 2026-02-31 would roll on into March: not a day.
  const back = localDate(midnight, TZ);
  return back.year === year && back.month === month && back.day === day ? midnight : null;
}

/**
 * [start, end) as a block of the day starting at `day`, clipped to it, or
 * null if it isn't on that day; whole-day when it covers all of it.
 */
export function segmentOnDay(
  start: number,
  end: number,
  day: number,
  calendarId: string,
): DaySegment | null {
  const next = addDays(day, 1, TZ);
  if (start >= next || end <= day) return null;
  const from = Math.max(start, day);
  const to = Math.min(end, next);
  return {
    calendarId,
    start: new Date(from),
    end: new Date(to),
    allDay: from === day && to === next,
    continuesBefore: start < day,
    continuesAfter: end > next,
  };
}
