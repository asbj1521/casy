/**
 * The phone's calendars, as the app's plugin reads them (PhoneCalendarPlugin
 * in ios/), turned into what Casy stores: each calendar's busy blocks. The
 * same rules as the server's adapters for every other calendar, so a calendar
 * counts alike whichever way it reached Casy:
 *
 *  - cancelled events and ones the person declined never block;
 *  - timed events marked free don't block;
 *  - all-day events always block, even marked free (Apple and Outlook make
 *    them free by default), and are read as whole days in Danish time, as the
 *    server reads dates without a zone (DEFAULT_ZONE in _shared/timezones.ts);
 *  - each calendar's blocks are merged where they overlap or touch.
 *
 * Pure: the plugin's answer goes in, the push to the server comes out.
 */
import { APP_TIME_ZONE, wallTime } from "@/lib/zone";

/** One calendar on the phone, as the plugin lists it. */
export interface PhoneCalendar {
  /** EventKit's calendarIdentifier: stable while the calendar exists on the phone. */
  id: string;
  name: string;
  /** The account it belongs to, as the phone names it ("iCloud", an email). */
  account: string;
  /** A subscribed calendar (a feed, Apple's holidays), not one of the person's own. */
  subscribed: boolean;
}

/** One event's timing; nothing else about it is read. */
export interface PhoneEvent {
  calendarId: string;
  allDay: boolean;
  free: boolean;
  cancelled: boolean;
  declined: boolean;
  /** Timed events: epoch ms. */
  start?: number;
  end?: number;
  /** All-day events: the phone's calendar dates, end exclusive ("2026-10-12"). */
  startDay?: string;
  endDay?: string;
}

export interface PhoneRead {
  calendars: PhoneCalendar[];
  events: PhoneEvent[];
}

/** One calendar as sent to the server. */
export interface PhoneCalendarPush {
  id: string;
  /** What My calendar lists it as. */
  name: string;
  /** Only whole days, in a subscription: most likely holidays, which shouldn't block. Unticked when first seen. */
  hidden: boolean;
  blocks: { start: string; end: string }[];
}

/** How far back and ahead the phone is read: the server's sync window (_shared/syncWindow.ts). */
export const PHONE_DAYS_BEHIND = 7;
export const PHONE_DAYS_AHEAD = 12 * 30;
const DAY_MS = 86_400_000;

/** The span to read, around `now` (plain milliseconds: a span, not calendar days). */
export function phoneWindow(now: number): { from: number; to: number } {
  return { from: now - PHONE_DAYS_BEHIND * DAY_MS, to: now + PHONE_DAYS_AHEAD * DAY_MS };
}

/** Local midnight in Danish time of a "YYYY-MM-DD" date, or null if it isn't one. */
function danishMidnight(day: string | undefined): number | null {
  const m = day ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(day) : null;
  if (!m) return null;
  return wallTime(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, APP_TIME_ZONE);
}

/** The instants an event keeps busy, or null if it doesn't block at all. */
export function busySpan(event: PhoneEvent): { start: number; end: number } | null {
  if (event.cancelled || event.declined) return null;
  if (event.allDay) {
    const start = danishMidnight(event.startDay);
    const end = danishMidnight(event.endDay);
    return start !== null && end !== null && end > start ? { start, end } : null;
  }
  if (event.free) return null;
  const { start, end } = event;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

/** Overlapping or touching spans joined into one. */
function merge(spans: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * The names My calendar shows: the calendar's own, with its account added
 * where two calendars on the phone share a name ("Calendar" in iCloud and in
 * Gmail), so they can be told apart.
 */
function displayNames(calendars: PhoneCalendar[]): Map<string, string> {
  const count = new Map<string, number>();
  for (const c of calendars) count.set(c.name, (count.get(c.name) ?? 0) + 1);
  return new Map(
    calendars.map((c) => [
      c.id,
      (count.get(c.name) ?? 0) > 1 && c.account ? `${c.name} (${c.account})` : c.name,
    ]),
  );
}

/** What the app sends: every calendar on the phone and its merged busy blocks within the window. */
export function phoneBusy(
  read: PhoneRead,
  window: { from: number; to: number },
): PhoneCalendarPush[] {
  const spans = new Map<string, { start: number; end: number }[]>();
  const timedIn = new Set<string>();
  const anyIn = new Set<string>();
  for (const event of read.events) {
    anyIn.add(event.calendarId);
    if (!event.allDay) timedIn.add(event.calendarId);
    const span = busySpan(event);
    if (!span || span.end <= window.from || span.start >= window.to) continue;
    const list = spans.get(event.calendarId) ?? [];
    list.push(span);
    spans.set(event.calendarId, list);
  }
  const names = displayNames(read.calendars);
  return read.calendars.map((c) => ({
    id: c.id,
    name: names.get(c.id) ?? c.name,
    hidden: c.subscribed && anyIn.has(c.id) && !timedIn.has(c.id),
    blocks: merge(spans.get(c.id) ?? []).map((s) => ({
      start: new Date(s.start).toISOString(),
      end: new Date(s.end).toISOString(),
    })),
  }));
}
