/**
 * The times of year nobody is free, whatever their calendars say:
 *  - Christmas: 23 to 26 December, all day (lillejuleaften to 2. juledag);
 *  - New Year: 31 December from 18:00 until 12:00 on 1 January.
 *
 * They go into every participant's busy time (withHolidayBlocks) as blocks
 * of priority "never", so every search treats them like anyone's own "never"
 * calendar: meetings, trips and holidays, the day chart, "Also possible", and
 * the next date after a decline. Marked `holiday`, so the warnings about a
 * meeting's edges leave them out (earlyMorning.ts): they are nobody's own
 * plans, and "everyone has something ending at 12:00" says nothing.
 *
 * Local times in the zone given, the app's APP_TIME_ZONE in practice.
 */
import { localDate, wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

const iso = (ms: number) => new Date(ms).toISOString();

const block = (start: number, end: number): BusyInterval => ({
  start: iso(start),
  end: iso(end),
  priority: "never",
  holiday: true,
});

/** Each year's blocks: its Christmas, and the New Year it ends with. */
export function holidayBlocks(years: number[], timeZone: string): BusyInterval[] {
  return years.flatMap((y) => [
    // wallTime's month is 0-based: 11 is December; day 27 at 00:00 ends the 26th.
    block(wallTime(y, 11, 23, 0, timeZone), wallTime(y, 11, 27, 0, timeZone)),
    block(wallTime(y, 11, 31, 18, timeZone), wallTime(y + 1, 0, 1, 12, timeZone)),
  ]);
}

/**
 * `participants` with the holiday blocks added to everyone's busy time. The
 * searches reach from a week back to 12 months ahead, so last year's New Year
 * and next year's Christmas are as far as they ever need.
 */
export function withHolidayBlocks(
  participants: Participant[],
  timeZone: string,
  now: number = Date.now(),
): Participant[] {
  const { year } = localDate(now, timeZone);
  const blocks = holidayBlocks([year - 1, year, year + 1], timeZone);
  return participants.map((p) => ({ ...p, busy: [...p.busy, ...blocks] }));
}
