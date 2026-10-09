/**
 * Layout logic for My calendar (/calendar-overview): a month grid of the
 * user's own collected busy blocks.
 *
 * Days and times here are in the zone the page passes (APP_TIME_ZONE, Danish
 * time), never the browser's own: My calendar has to show a busy block at the
 * same hour the scheduling page reasons about it, or someone abroad would see
 * their Friday 18:00 dinner at 12:00 here while the scheduler avoids 18:00.
 * Every function takes the zone, like the engine (lib/zone.ts). Everything
 * here is a pure function over plain data so it can be tested without a
 * browser or a network.
 *
 * Privacy: blocks carry only a time range and the calendar they came from.
 * There is no event title anywhere in this data, by design.
 */

import type { Lang } from "@/i18n/locale";
import { danishHolidays, type Holiday } from "@/lib/danishHolidays";
import { formatTime } from "@/lib/format";
import { addDays, localDate, startOfDay, wallTime } from "@/lib/zone";
import type { CalendarPriority, CalendarProvider, CalendarPurpose } from "@/types";

/** One connected calendar, as returned by the calendar-busy function. */
export interface OverviewCalendar {
  id: string;
  /** The name to show: the one its owner gave it, else the provider's own. */
  name: string;
  /** The provider's own name, shown under a renamed calendar. */
  originalName: string | null;
  /** True when its owner renamed it. */
  renamed: boolean;
  /** Casy may add events to it, so it can be the primary calendar. */
  writable: boolean;
  /** The category the user gave this calendar, or null if unset. */
  purpose: CalendarPurpose | null;
  /** How much it matters to its owner when scheduling. */
  priority: CalendarPriority;
  /** False once its owner unticked it on My calendar: it then counts nowhere. */
  included: boolean;
  /** Busy blocks stored for it over the whole synced range, not just the month on screen. */
  total: number;
  /** "builtin" marks a calendar Casy provides itself, with no account behind it. */
  provider: CalendarProvider | "builtin";
  /** The account it belongs to (an email, or a link's name). */
  account: string | null;
  connectionId: string;
}

/** A busy block. `start` inclusive, `end` exclusive, ISO 8601 UTC. */
export interface OverviewBlock {
  calendarId: string;
  start: string;
  end: string;
}

export interface OverviewData {
  calendars: OverviewCalendar[];
  blocks: OverviewBlock[];
  /** True if the backend stopped early because there were too many blocks. */
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Month layout
// ---------------------------------------------------------------------------

export interface MonthDay {
  /** The calendar day as "YYYY-MM-DD", used as a stable key. */
  key: string;
  /** Midnight at the start of the day. */
  date: Date;
  dayOfMonth: number;
  /** False for the spill-over days that pad the grid from neighbouring months. */
  inMonth: boolean;
}

export interface MonthLayout {
  /** e.g. "september 2026". */
  label: string;
  /** Column headers, Monday-first, in the page's language. */
  weekdayLabels: string[];
  weeks: MonthDay[][];
  /** ISO 8601 week number for each row of `weeks` (Danish "uge"). */
  weekNumbers: number[];
  /** Start of the first grid cell (midnight). */
  from: Date;
  /** Start of the day after the last grid cell (midnight, exclusive). */
  to: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Monday-first short weekday names: "man." to "søn.", or "Mon" to "Sun". */
function mondayFirstWeekdays(locale: string): string[] {
  // 1 January 2024 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, {
      weekday: "short",
      timeZone: "UTC",
    }),
  );
}

/** "YYYY-MM-DD" for the calendar day containing `d` in `timeZone`. */
export function dayKey(d: Date, timeZone: string): string {
  const { year, month, day } = localDate(d.getTime(), timeZone);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * ISO 8601 week number (1 to 53) of the calendar day containing `date` in
 * `timeZone`.
 * Weeks start on Monday, and week 1 is the week containing the year's first
 * Thursday, which is the numbering Denmark uses. The week number belongs to
 * the year of that Thursday, so 1 January can fall in week 52 or 53 and 31
 * December in week 1.
 */
export function isoWeekNumber(date: Date, timeZone: string): number {
  // Work in UTC on the zone's y/m/d so daylight saving can't shift the day.
  const { year, month, day } = localDate(date.getTime(), timeZone);
  const utc = Date.UTC(year, month, day);
  const mondayBasedDay = (new Date(utc).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = utc + (3 - mondayBasedDay) * 86_400_000;
  const jan1 = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - jan1) / 86_400_000 / 7) + 1;
}

/**
 * A Monday-first month grid padded with spill-over days to whole weeks (4 to
 * 6 rows).
 *
 * @param monthIndex 0-based (0 = January)
 */
export function buildMonthLayout(
  year: number,
  monthIndex: number,
  timeZone: string,
  locale = "da-DK",
): MonthLayout {
  // The grid is a matter of calendar dates, worked out without any clock;
  // only each cell's midnight depends on the zone.
  const offset = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7; // days since Monday
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const rows = Math.ceil((offset + daysInMonth) / 7);
  // wallTime normalises out-of-range days, so this walks across month edges.
  const midnight = (n: number) => new Date(wallTime(year, monthIndex, 1 - offset + n, 0, timeZone));

  const weeks: MonthDay[][] = [];
  for (let r = 0; r < rows; r++) {
    const week: MonthDay[] = [];
    for (let c = 0; c < 7; c++) {
      const date = midnight(r * 7 + c);
      const local = localDate(date.getTime(), timeZone);
      week.push({
        key: dayKey(date, timeZone),
        date,
        dayOfMonth: local.day,
        inMonth: local.month === monthIndex,
      });
    }
    weeks.push(week);
  }

  return {
    label: new Date(wallTime(year, monthIndex, 1, 12, timeZone)).toLocaleString(locale, {
      month: "long",
      year: "numeric",
      timeZone,
    }),
    weekdayLabels: mondayFirstWeekdays(locale),
    weeks,
    weekNumbers: weeks.map((week) => isoWeekNumber(week[0].date, timeZone)),
    from: weeks[0][0].date,
    to: midnight(rows * 7),
  };
}

// ---------------------------------------------------------------------------
// Blocks -> per-day segments
// ---------------------------------------------------------------------------

/** The part of one busy block that falls on one day. */
export interface DaySegment {
  calendarId: string;
  /** Clipped to the day. */
  start: Date;
  /** Clipped to the day; may be the following midnight. */
  end: Date;
  /** Covers the whole day (an all-day event, or the middle of a long one). */
  allDay: boolean;
  /** The block began on an earlier day. */
  continuesBefore: boolean;
  /** The block runs on into a later day. */
  continuesAfter: boolean;
  /** Set for a built-in holiday entry; these are days, not busy time. */
  holiday?: Holiday;
}

const MAX_DAYS_PER_BLOCK = 400; // guard against a malformed, endless block

/**
 * Split blocks at midnight in `timeZone` and group the pieces by day, limited
 * to [from, to). Each day's segments are sorted by start time.
 */
export function segmentByDay(
  blocks: OverviewBlock[],
  from: Date,
  to: Date,
  timeZone: string,
): Map<string, DaySegment[]> {
  const byDay = new Map<string, DaySegment[]>();
  for (const b of blocks) {
    const bs = new Date(b.start);
    const be = new Date(b.end);
    if (!(be > bs) || be <= from || bs >= to) continue;

    const limit = be < to ? be : to;
    let day = new Date(startOfDay((bs > from ? bs : from).getTime(), timeZone));
    for (let n = 0; day < limit && n < MAX_DAYS_PER_BLOCK; n++) {
      // Stepped by calendar day (not +24h) so 23- and 25-hour days at DST changes work.
      const next = new Date(addDays(day.getTime(), 1, timeZone));
      const start = bs > day ? bs : day;
      const end = be < next ? be : next;
      if (end > start) {
        const key = dayKey(day, timeZone);
        const list = byDay.get(key) ?? [];
        list.push({
          calendarId: b.calendarId,
          start,
          end,
          allDay: start.getTime() === day.getTime() && end.getTime() === next.getTime(),
          continuesBefore: bs < day,
          continuesAfter: be > next,
        });
        byDay.set(key, list);
      }
      day = next;
    }
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  }
  return byDay;
}

// ---------------------------------------------------------------------------
// Built-in Danish holidays
// ---------------------------------------------------------------------------

export const HOLIDAY_CALENDAR_ID = "builtin:dk-holidays";

/** The always-present holiday calendar: computed, not connected, no account. */
export const HOLIDAY_CALENDAR: OverviewCalendar = {
  id: HOLIDAY_CALENDAR_ID,
  name: "Danish public holidays",
  originalName: null,
  renamed: false,
  writable: false,
  purpose: null,
  priority: "normal",
  included: true,
  total: 0,
  provider: "builtin",
  account: null,
  connectionId: HOLIDAY_CALENDAR_ID,
};

/** "r, g, b" for holidays. Red, deliberately not used by categories or the palette. */
const HOLIDAY_RGB = "220, 38, 38";

/** Holidays inside [from, to), as all-day segments keyed by day in `timeZone`. */
export function holidaySegmentsByDay(
  from: Date,
  to: Date,
  timeZone: string,
): Map<string, DaySegment[]> {
  const byDay = new Map<string, DaySegment[]>();
  const firstYear = localDate(from.getTime(), timeZone).year;
  const lastYear = localDate(to.getTime() - 1, timeZone).year; // a grid can straddle two years
  for (let year = firstYear; year <= lastYear; year++) {
    for (const holiday of danishHolidays(year, timeZone)) {
      if (holiday.date < from || holiday.date >= to) continue;
      const next = new Date(addDays(holiday.date.getTime(), 1, timeZone));
      const list = byDay.get(holiday.key) ?? [];
      list.push({
        calendarId: HOLIDAY_CALENDAR_ID,
        start: holiday.date,
        end: next,
        allDay: true,
        continuesBefore: false,
        continuesAfter: false,
        holiday,
      });
      byDay.set(holiday.key, list);
    }
  }
  return byDay;
}

/** Put each day's holidays ahead of that day's other segments. Inputs are not modified. */
export function withHolidays(
  segments: Map<string, DaySegment[]>,
  holidays: Map<string, DaySegment[]>,
): Map<string, DaySegment[]> {
  const merged = new Map(segments);
  for (const [key, list] of holidays) merged.set(key, [...list, ...(segments.get(key) ?? [])]);
  return merged;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * "09:15-11:20", "All day", or "22:00-24:00" for a segment ending at
 * midnight, in `timeZone`.
 */
export function formatSegmentRange(seg: DaySegment, timeZone: string, allDay = "All day"): string {
  if (seg.allDay) return allDay;
  const endsAtMidnight =
    seg.end > seg.start && startOfDay(seg.end.getTime(), timeZone) === seg.end.getTime();
  const time = (d: Date) => formatTime(d.toISOString(), timeZone);
  return `${time(seg.start)}-${endsAtMidnight ? "24:00" : time(seg.end)}`;
}

/** "2 h 35 min", "45 min", "3 h"; `hourUnit` is "t" in Danish. */
export function formatDuration(start: Date, end: Date, hourUnit = "h"): string {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} ${hourUnit}` : `${h} ${hourUnit} ${m} min`;
}

// ---------------------------------------------------------------------------
// Categories and colours
// ---------------------------------------------------------------------------

/** The categories a calendar can have, in the order the picker lists them. */
export const CATEGORIES: CalendarPurpose[] = ["work", "school", "personal", "other"];

/** "r, g, b" strings, for use in rgba(...). */
const CATEGORY_RGB: Record<CalendarPurpose, string> = {
  work: "59, 130, 246",
  school: "168, 85, 247",
  personal: "34, 197, 94",
  other: "113, 113, 122",
};

// For calendars with no category yet. The first is the app's accent orange.
const UNCATEGORISED_PALETTE = [
  "249, 115, 22",
  "20, 184, 166",
  "236, 72, 153",
  "234, 179, 8",
  "132, 204, 22",
  "6, 182, 212",
  "99, 102, 241",
];

/**
 * One colour per calendar: its category's colour if it has one, otherwise the
 * next colour from a palette so uncategorised calendars stay distinguishable.
 */
export function calendarColors(calendars: OverviewCalendar[]): Map<string, string> {
  const colors = new Map<string, string>([[HOLIDAY_CALENDAR_ID, HOLIDAY_RGB]]);
  let uncategorised = 0;
  for (const c of calendars) {
    if (c.purpose) {
      colors.set(c.id, CATEGORY_RGB[c.purpose]);
    } else {
      colors.set(c.id, UNCATEGORISED_PALETTE[uncategorised % UNCATEGORISED_PALETTE.length]);
      uncategorised++;
    }
  }
  return colors;
}

// ---------------------------------------------------------------------------
// Calendar list grouping
// ---------------------------------------------------------------------------

/** The brands the calendar list is grouped by, in the order they are shown. */
const BRANDS: { provider: OverviewCalendar["provider"]; label: string }[] = [
  { provider: "google", label: "Google" },
  { provider: "outlook", label: "Outlook" },
  { provider: "apple", label: "Apple" },
  // Calendars added by link (a timetable, a shared feed): no brand of their own.
  { provider: "ics", label: "Special" },
  // The iPhone app's phone calendars (#63).
  { provider: "device", label: "Phone" },
  { provider: "builtin", label: "Built in" },
];

export interface CalendarGroup {
  /** The provider this group holds, which is also its stable key. */
  id: OverviewCalendar["provider"];
  label: string;
  calendars: OverviewCalendar[];
}

/**
 * Split calendars into one group per brand, in a fixed order. Brands with no
 * calendars are left out, and calendars keep the order they came in within
 * their group. A provider this list doesn't know about (a new integration)
 * gets a group of its own at the end instead of silently vanishing.
 */
export function groupCalendarsByBrand(calendars: OverviewCalendar[]): CalendarGroup[] {
  const known = new Set(BRANDS.map((b) => b.provider));
  const groups: CalendarGroup[] = BRANDS.map((b) => ({
    id: b.provider,
    label: b.label,
    calendars: calendars.filter((c) => c.provider === b.provider),
  }));
  for (const c of calendars) {
    if (known.has(c.provider)) continue;
    const label = String(c.provider);
    const existing = groups.find((g) => g.id === c.provider);
    if (existing) existing.calendars.push(c);
    else groups.push({ id: c.provider, label, calendars: [c] });
  }
  return groups.filter((g) => g.calendars.length > 0);
}

/**
 * What a group's checkbox should show: every calendar ticked ("all"), none
 * of them ("none"), or a mix ("some", the indeterminate dash).
 */
export function groupVisibility(group: CalendarGroup): "all" | "none" | "some" {
  const unticked = group.calendars.filter((c) => !c.included).length;
  if (unticked === 0) return "all";
  return unticked === group.calendars.length ? "none" : "some";
}

/**
 * How many holidays fall between today and a year ahead: the count shown
 * beside the built-in holiday calendar, over the range the connected
 * calendars are synced for.
 */
export function holidaysInYearAhead(timeZone: string): number {
  const today = new Date();
  const { year, month, day } = localDate(today.getTime(), timeZone);
  const yearAhead = new Date(wallTime(year + 1, month, day, 0, timeZone));
  return [...holidaySegmentsByDay(today, yearAhead, timeZone).values()].reduce(
    (sum, list) => sum + list.length,
    0,
  );
}

/** A holiday's name in the given language. */
export function holidayName(holiday: NonNullable<DaySegment["holiday"]>, lang: Lang): string {
  return lang === "da" ? holiday.name : holiday.englishName;
}
