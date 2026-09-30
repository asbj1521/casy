/**
 * Builds a month calendar grid tinted by availability — the killer visual.
 *
 * It lays out a single calendar month, Monday-first, with leading/trailing days
 * from the neighbouring months padding the grid to whole weeks. For every day in
 * the month we compute how many people are free for a meeting at the chosen
 * time, and the UI tints each day by that count so the best days jump out. Days
 * in the past keep their tint but get dimmed in the UI.
 *
 * Like the engine, this is a pure function over the data model. Days, hours
 * and weekdays are local to the zone it is given (src/lib/zone.ts).
 */

import {
  blockOverlaps,
  isSkippable,
  spanAvailability,
  type WeeklySpanShape,
} from "@/lib/availability";
import { mondayFirstWeekdays } from "@/lib/dateLabels";
import { ANY_TIME_EARLIEST_HOUR, ANY_TIME_LATEST_HOUR } from "@/lib/eventSearch";
import type { BusyInterval, Participant } from "@/types";
import { addDays, atHour, localDate, startOfDay, wallTime } from "@/lib/zone";

export interface DayCell {
  /** The instant of local midnight at the start of this day, ISO 8601. */
  date: string;
  /** Day number 1–31, for the cell label. */
  dayOfMonth: number;
  /** True if this day belongs to the displayed month (vs neighbouring spillover). */
  inMonth: boolean;
  /** True if this day is strictly before today (shown, but dimmed). */
  isPast: boolean;
  /** Participants genuinely free for the event on/starting this day. */
  freeCount: number;
  /**
   * Participants who are only free if they give something up: time off
   * work/school (multi-day modes), or skipping a calendar they marked
   * skippable (single meetings).
   */
  conditionalCount: number;
  /** True if this day is not part of the search (unselected weekday, or a
   * day outside the weekly trip window) and should render neutral. */
  excluded: boolean;
  /** Total participant count, i.e. the max freeCount can be. */
  total: number;
}

export interface MonthGrid {
  /** e.g. "juni 2026". */
  label: string;
  /** Column headers, Monday-first. */
  weekdayLabels: string[];
  /** Calendar rows, each with 7 day cells (including spillover padding). */
  weeks: DayCell[][];
  /** Total participant count. */
  total: number;
}

/**
 * Whether the participant is free for [start, end): outright, only by
 * skipping blocks they marked skippable ("conditional"), or not at all.
 */
function meetingAvailability(
  participant: Participant,
  start: number,
  end: number,
): "free" | "conditional" | "busy" {
  let skipping = false;
  for (const b of participant.busy) {
    if (!blockOverlaps(b, start, end)) continue;
    if (!isSkippable(b)) return "busy";
    skipping = true;
  }
  return skipping ? "conditional" : "free";
}

/**
 * How many participants are free for a meeting of `durationMs` starting at
 * `startHour` on the given day — i.e. availability at the *chosen* meeting time,
 * not "the best slot anywhere in the evening". Anchoring to the configured start
 * gives a real gradient at any group size (a wide window plus a short meeting
 * almost always finds some common gap, which washes small groups out to all-free).
 * The meeting may spill past midnight (a night out ending 02:00), matching the
 * engine's uncapped `latestHour`.
 */
function freeForMeetingOnDay(
  participants: Participant[],
  dayMidnight: number,
  startHour: number,
  durationMs: number,
  timeZone: string,
): { free: number; conditional: number } {
  const start = atHour(dayMidnight, startHour, timeZone);
  const end = start + durationMs;
  let free = 0;
  let conditional = 0;
  for (const p of participants) {
    const a = meetingAvailability(p, start, end);
    if (a === "free") free++;
    else if (a === "conditional") conditional++;
  }
  return { free, conditional };
}

/**
 * The longest free stretch (ms) in [start, end) once blocks `skip` filters
 * out are set aside — the building block for "is there room somewhere in the
 * day", rather than "is this one exact window free".
 */
function longestGapMs(
  busy: BusyInterval[],
  start: number,
  end: number,
  skip: (b: BusyInterval) => boolean,
): number {
  const bounds: Array<{ start: number; end: number }> = [];
  for (const b of busy) {
    if (skip(b) || !blockOverlaps(b, start, end)) continue;
    const s = Math.max(Date.parse(b.start), start);
    const e = Math.min(Date.parse(b.end), end);
    if (e > s) bounds.push({ start: s, end: e });
  }
  bounds.sort((a, b) => a.start - b.start);

  let cursor = start;
  let longest = 0;
  for (const b of bounds) {
    if (b.start > cursor) longest = Math.max(longest, b.start - cursor);
    cursor = Math.max(cursor, b.end);
  }
  return Math.max(longest, end - cursor);
}

/**
 * How many participants have room for a meeting of `durationMs` *somewhere*
 * in [windowStart, windowEnd) — the day's allowed any-time hours, not the
 * whole day: outright if a long-enough free stretch exists without touching
 * anything skippable, conditional if it only opens up once skippable blocks
 * are set aside.
 */
function freeAnyTimeOnDay(
  participants: Participant[],
  windowStart: number,
  windowEnd: number,
  durationMs: number,
): { free: number; conditional: number } {
  let free = 0;
  let conditional = 0;
  for (const p of participants) {
    if (longestGapMs(p.busy, windowStart, windowEnd, () => false) >= durationMs) {
      free++;
    } else if (longestGapMs(p.busy, windowStart, windowEnd, isSkippable) >= durationMs) {
      conditional++;
    }
  }
  return { free, conditional };
}

/** How availability is computed for each day cell. */
export interface MonthGridOptions {
  /** IANA zone the days, hours and weekdays are local to. */
  timeZone: string;
  /** Local meeting start hour for single-day events, 0–23. Unused if anyTime. */
  startHour: number;
  /** Meeting length in minutes (may cross midnight). */
  durationMinutes: number;
  /**
   * Single-day events only: ignore startHour and look for a free stretch of
   * durationMinutes anywhere in the day's 10:00-22:00 window, instead of
   * only at that exact hour.
   */
  anyTime?: boolean;
  /** Any instant "now", used to flag past days. */
  todayMs: number;
  /**
   * Which local days of week are searched for single-day events (0 = Sun … 6 =
   * Sat). Days outside the set render as excluded. Omitted = all seven.
   */
  allowedDays?: number[];
  /**
   * Vacation mode: tint each day by who could join a vacation on *that day*
   * (amber-split for people whose only obstacle that day is work/school).
   * Per-day, so the same person reads as busy on the same days in every
   * mode — span reasoning lives in the engine, not the map.
   */
  multiDay?: { windowEndMs: number };
  /**
   * Weekend-trip mode: days belonging to the weekly window (e.g. Fri–Sun)
   * are tinted by who is available for that day's part of the trip (Friday
   * from `startHour`, the last day until `endHour`, whole days between);
   * other days are excluded. Takes precedence over `multiDay`.
   */
  weeklySpan?: WeeklySpanShape & { windowEndMs: number };
  /** Locale for the month heading and weekday headers. Defaults to Danish. */
  locale?: string;
}

/**
 * Build a Monday-first calendar grid for a single month. The month's days are
 * padded with spillover days from the neighbouring months to fill whole weeks
 * (usually 5 rows, occasionally 6). Availability is computed for the month's own
 * days only; spillover cells are left blank for the UI to mute.
 *
 * @param year  full year, e.g. 2026
 * @param month 0-based month index (0 = January)
 */
export function buildMonthGrid(
  participants: Participant[],
  year: number,
  month: number,
  opts: MonthGridOptions,
): MonthGrid {
  const { timeZone, startHour, durationMinutes, todayMs, allowedDays, multiDay, weeklySpan } = opts;
  const durationMs = durationMinutes * 60_000;
  const firstOfMonth = wallTime(year, month, 1, 0, timeZone);
  const firstDow = localDate(firstOfMonth, timeZone).dow; // 0 = Sun … 6 = Sat
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const todayMidnight = startOfDay(todayMs, timeZone);

  // Monday-first leading offset: how many days of the previous month to show.
  const leading = (firstDow + 6) % 7;
  const numWeeks = Math.ceil((leading + daysInMonth) / 7);

  const weeks: DayCell[][] = [];
  for (let week = 0; week < numWeeks; week++) {
    const row: DayCell[] = [];
    for (let col = 0; col < 7; col++) {
      // Built from the calendar date, not by adding 24 h per cell, so a grid
      // crossing a clock change still has every cell on a local midnight.
      const dayMidnight = wallTime(year, month, 1 - leading + week * 7 + col, 0, timeZone);
      const nextMidnight = addDays(dayMidnight, 1, timeZone);
      const d = localDate(dayMidnight, timeZone);
      const dow = d.dow;
      const inMonth = d.month === month && d.year === year;

      let freeCount = 0;
      let conditionalCount = 0;
      let excluded = false;

      if (inMonth) {
        if (weeklySpan) {
          // Trip mode: a day is either part of the weekly trip window (and
          // shows availability for that day's slice of the trip) or not
          // searched at all.
          const offset = (dow - weeklySpan.anchorDow + 7) % 7;
          if (offset >= weeklySpan.spanDays) {
            excluded = true;
          } else {
            const sliceStart =
              offset === 0 ? atHour(dayMidnight, weeklySpan.startHour, timeZone) : dayMidnight;
            const sliceEnd =
              offset === weeklySpan.spanDays - 1
                ? atHour(dayMidnight, weeklySpan.endHour, timeZone)
                : nextMidnight;
            if (sliceEnd <= weeklySpan.windowEndMs) {
              const a = spanAvailability(participants, sliceStart, sliceEnd);
              freeCount = a.free;
              conditionalCount = a.conditional;
            }
          }
        } else if (multiDay) {
          // Vacation mode: per-day availability, same data story as the
          // other modes.
          if (nextMidnight <= multiDay.windowEndMs) {
            const a = spanAvailability(participants, dayMidnight, nextMidnight);
            freeCount = a.free;
            conditionalCount = a.conditional;
          }
        } else if (allowedDays && !allowedDays.includes(dow)) {
          excluded = true;
        } else {
          const a = opts.anyTime
            ? freeAnyTimeOnDay(
                participants,
                atHour(dayMidnight, ANY_TIME_EARLIEST_HOUR, timeZone),
                atHour(dayMidnight, ANY_TIME_LATEST_HOUR, timeZone),
                durationMs,
              )
            : freeForMeetingOnDay(participants, dayMidnight, startHour, durationMs, timeZone);
          freeCount = a.free;
          conditionalCount = a.conditional;
        }
      }

      row.push({
        date: new Date(dayMidnight).toISOString(),
        dayOfMonth: d.day,
        inMonth,
        isPast: dayMidnight < todayMidnight,
        freeCount,
        conditionalCount,
        excluded,
        total: participants.length,
      });
    }
    weeks.push(row);
  }

  const locale = opts.locale ?? "da-DK";
  const monthName = new Date(firstOfMonth).toLocaleString(locale, {
    month: "long",
    timeZone,
  });

  return {
    label: `${monthName} ${year}`,
    weekdayLabels: mondayFirstWeekdays(locale),
    weeks,
    total: participants.length,
  };
}
