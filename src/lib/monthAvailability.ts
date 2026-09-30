/**
 * How much of the group can make each day of a month: the numbers behind the
 * scheduling page's day chart (DayChart.tsx).
 *
 * Each day counts who is free for the event the settings describe: at the
 * chosen meeting time (or anywhere in the any-time hours), for that day's part
 * of a weekend trip, or all day for a holiday. People who could only make it
 * by skipping something, or by taking time off work or school, are counted
 * apart, so the chart can show them as such.
 *
 * It reads the same EventSettings the search runs (eventSearch.ts) and judges
 * busy blocks by the engine's rules (availability.ts), so the chart and the
 * answer above it always tell the same story. Like the engine, a pure
 * function; days, hours and weekdays are local to the zone it is given.
 */

import {
  blockOverlaps,
  blockRange,
  isSkippable,
  spanAvailability,
  type Interval,
} from "@/lib/availability";
import {
  ANY_TIME_EARLIEST_HOUR,
  ANY_TIME_LATEST_HOUR,
  type EventSettings,
} from "@/lib/eventSearch";
import { capitalize } from "@/lib/format";
import { addDays, atHour, localDate, startOfDay, wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

export interface DayCell {
  /** The instant of local midnight at the start of this day, ISO 8601. */
  date: string;
  /** Day number 1-31. */
  dayOfMonth: number;
  /** True if this day is strictly before today (shown, but flat). */
  isPast: boolean;
  /** Participants genuinely free for the event on (or starting) this day. */
  freeCount: number;
  /**
   * Participants who are only free if they give something up: time off
   * work/school (trips and holidays), or skipping a calendar they marked
   * skippable (single meetings).
   */
  conditionalCount: number;
  /** True if this day is not searched at all: an unticked weekday, or a day outside a weekly trip. */
  excluded: boolean;
}

export interface MonthAvailability {
  /** "Juni 2026", capitalised for a heading. */
  label: string;
  /** Every day of the month, the 1st first. */
  days: DayCell[];
  /** How many participants there are: what freeCount can reach. */
  total: number;
}

export interface MonthAvailabilityOptions {
  /** IANA zone the days, hours and weekdays are local to. */
  timeZone: string;
  /** Any instant today, to flag past days. */
  todayMs: number;
  /** Where the search window ends: trip and holiday days past it count nobody. */
  windowEndMs: number;
  /** For the month's name. Defaults to Danish. */
  locale?: string;
}

type Counts = { free: number; conditional: number };

const NOBODY: Counts = { free: 0, conditional: 0 };

/**
 * One month, day by day, for the event `search` describes.
 *
 * @param year  full year, e.g. 2026
 * @param month 0-based month index (0 = January)
 */
export function monthAvailability(
  participants: Participant[],
  search: EventSettings,
  year: number,
  month: number,
  opts: MonthAvailabilityOptions,
): MonthAvailability {
  const { timeZone } = opts;
  const todayMidnight = startOfDay(opts.todayMs, timeZone);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const days: DayCell[] = [];
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
    // Built from the calendar date, not by adding 24 h per day, so a month
    // with a clock change still has every day on a local midnight.
    const midnight = wallTime(year, month, dayOfMonth, 0, timeZone);
    const day = dayAvailability(participants, search, midnight, opts);
    days.push({
      date: new Date(midnight).toISOString(),
      dayOfMonth,
      isPast: midnight < todayMidnight,
      freeCount: day?.free ?? 0,
      conditionalCount: day?.conditional ?? 0,
      excluded: day === null,
    });
  }

  const monthName = new Date(wallTime(year, month, 1, 0, timeZone)).toLocaleString(
    opts.locale ?? "da-DK",
    { month: "long", timeZone },
  );
  return { label: `${capitalize(monthName)} ${year}`, days, total: participants.length };
}

/** Who can make the day starting at `midnight`; null if the day isn't searched. */
function dayAvailability(
  participants: Participant[],
  search: EventSettings,
  midnight: number,
  { timeZone, windowEndMs }: MonthAvailabilityOptions,
): Counts | null {
  const nextMidnight = addDays(midnight, 1, timeZone);
  const dow = localDate(midnight, timeZone).dow;

  switch (search.kind) {
    case "trip": {
      // Only the days of the weekly window count, each for its own part of
      // the trip: the first from the start hour, the last until the end hour.
      const { anchorDow, spanDays, startHour, endHour } = search.shape;
      const offset = (dow - anchorDow + 7) % 7;
      if (offset >= spanDays) return null;
      const start = offset === 0 ? atHour(midnight, startHour, timeZone) : midnight;
      const end = offset === spanDays - 1 ? atHour(midnight, endHour, timeZone) : nextMidnight;
      return end <= windowEndMs ? spanAvailability(participants, start, end) : NOBODY;
    }
    case "vacation":
      // Per day, so the same person reads as busy on the same days in every
      // mode: which run of days is best is the engine's question, not the chart's.
      return nextMidnight <= windowEndMs
        ? spanAvailability(participants, midnight, nextMidnight)
        : NOBODY;
    case "single": {
      if (search.allowedDays && !search.allowedDays.includes(dow)) return null;
      const durationMs = search.durationMinutes * 60_000;
      if (search.anyTime) {
        return freeSomewhere(
          participants,
          atHour(midnight, ANY_TIME_EARLIEST_HOUR, timeZone),
          atHour(midnight, ANY_TIME_LATEST_HOUR, timeZone),
          durationMs,
        );
      }
      // At the chosen time itself, not "the best slot anywhere in the
      // evening": a wide window plus a short meeting almost always finds some
      // common gap, which would wash small groups out to all-free. The meeting
      // may run past midnight (a night out ending 02:00), as in the engine.
      const start = atHour(midnight, search.startHour, timeZone);
      return freeAt(participants, start, start + durationMs);
    }
  }
}

/** Who is free for [start, end): outright, or only by skipping what they marked skippable. */
function freeAt(participants: Participant[], start: number, end: number): Counts {
  const counts = { free: 0, conditional: 0 };
  for (const p of participants) {
    const clashes = p.busy.filter((b) => blockOverlaps(b, start, end));
    if (clashes.length === 0) counts.free++;
    else if (clashes.every(isSkippable)) counts.conditional++;
  }
  return counts;
}

/**
 * Who has room for a meeting of `durationMs` somewhere in [start, end), the
 * day's any-time hours: outright if a long enough free stretch exists,
 * conditional if one only opens up once skippable blocks are set aside.
 */
function freeSomewhere(
  participants: Participant[],
  start: number,
  end: number,
  durationMs: number,
): Counts {
  const counts = { free: 0, conditional: 0 };
  for (const p of participants) {
    if (longestGap(p.busy, start, end) >= durationMs) counts.free++;
    else if (
      longestGap(
        p.busy.filter((b) => !isSkippable(b)),
        start,
        end,
      ) >= durationMs
    ) {
      counts.conditional++;
    }
  }
  return counts;
}

/** The longest free stretch (ms) in [start, end) between `busy` blocks. */
function longestGap(busy: BusyInterval[], start: number, end: number): number {
  const clashes = busy
    .map(blockRange)
    .filter((iv): iv is Interval => iv !== null && iv.start < end && iv.end > start)
    .sort((a, b) => a.start - b.start);

  let cursor = start;
  let longest = 0;
  for (const iv of clashes) {
    longest = Math.max(longest, iv.start - cursor);
    cursor = Math.max(cursor, iv.end);
  }
  return Math.max(longest, end - cursor);
}
