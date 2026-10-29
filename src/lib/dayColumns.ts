/**
 * Where the days sit in Apple's day view (DayColumns, #74 and #176): which
 * days are in view for an offset from the day it opened on, which are drawn
 * either side to swipe into, and where each one's column starts. Pure, so a
 * day landing in the wrong column is a test failing rather than a screen
 * looking off.
 *
 * The days are one strip, `offset` days from `home`. With the picked day in
 * the middle (the swipe screen's three days) offset 0 shows the day before,
 * it and the day after; with it first (the home page's one or two days) it
 * is the left column.
 */
import { addDays, localDate } from "@/lib/zone";

/** Where the day a view is about sits among those in view. */
export type DayLead = "middle" | "first";

/** The first day in view (from home) at `offset`. */
function firstInView(offset: number, days: number, lead: DayLead): number {
  return lead === "middle" ? offset - Math.floor((days - 1) / 2) : offset;
}

/** The days in view at `offset`, as days from home, left to right. */
export function daysInView(offset: number, days: number, lead: DayLead): number[] {
  const first = firstInView(offset, days, lead);
  return Array.from({ length: days }, (_, i) => first + i);
}

/** The days in view and `beside` more either side, drawn so a swipe slides into a day already drawn. */
export function drawnDays(offset: number, days: number, lead: DayLead, beside: number): number[] {
  const first = firstInView(offset, days, lead) - beside;
  return Array.from({ length: days + 2 * beside }, (_, i) => first + i);
}

/**
 * Where day `k`'s column starts on the strip, in columns. The strip is moved
 * by `-offset` columns, so at any offset its first day in view is at 0.
 */
export function columnOf(k: number, days: number, lead: DayLead): number {
  return k - firstInView(0, days, lead);
}

/** Whole days from `a` to `b`, both local midnights; rounded for the 23 and 25 hour days. */
export function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / 86_400_000);
}

/** The Monday of the week `day` (a local midnight) is in. */
export function mondayOf(day: number, timeZone: string): number {
  return addDays(day, -((localDate(day, timeZone).dow + 6) % 7), timeZone);
}

/**
 * Where a day view opens when no date is asked for, as a part of the day (0
 * to 1): today on the time now, put in the middle; another day an hour
 * before its first timed event, put at the top; with none, 08:00 at the top.
 */
export function openingOf({
  now,
  firstEvent,
}: {
  /** The time now as a part of the day, when today is in view. */
  now: number | null;
  /** The first timed event's start in view, as a part of its day. */
  firstEvent: number | null;
}): { middle: number } | { top: number } {
  if (now !== null) return { middle: now };
  if (firstEvent !== null) return { top: Math.max(0, firstEvent - 1 / 24) };
  return { top: 8 / 24 };
}
