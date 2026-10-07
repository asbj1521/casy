/**
 * The rules for suggested events that are worth testing on their own: what
 * counts as valid search settings, what counts as a sensible date, and which
 * of an event's dates is the one on offer.
 *
 * isEventSettings mirrors src/lib/eventSearch.ts, which the browser uses to
 * run the search. Edge Functions can't import from src/, so the shape is
 * written out twice; this copy is the one that decides what gets stored.
 */
import { cleanText } from "./text.ts";

/** Longest event title we keep, matching the check constraint on the table. */
export const MAX_EVENT_TITLE_LENGTH = 60;

/** Longest span a date may cover: a 30-day vacation plus a little slack. */
const MAX_SPAN_MS = 31 * 24 * 60 * 60 * 1000;
/** How far ahead a date may be: the scheduling page searches about a year. */
const MAX_AHEAD_MS = 400 * 24 * 60 * 60 * 1000;

const int = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** True if `value` is search settings in one of the three known shapes. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who an event is for (#89), as src/lib/eventSearch.ts's isPeopleSettings
 * says: 1 to 20 distinct members (profile ids), the optional ones among
 * them, and "at least" (meetings only) from 1 to the number required. Ids
 * must be UUIDs here: they are written to the database as such.
 */
export function isPeopleSettings(value: unknown, kind: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  const ids = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string" && UUID.test(x));
  if (!ids(p.members) || !ids(p.optional)) return false;
  const members = new Set(p.members.map((id) => id.toLowerCase()));
  if (members.size !== p.members.length || members.size < 1 || members.size > 20) return false;
  if (new Set(p.optional).size !== p.optional.length) return false;
  if (!p.optional.every((id) => members.has(id.toLowerCase()))) return false;
  if (p.atLeast === undefined) return true;
  return kind === "single" && int(p.atLeast, 1, members.size - p.optional.length);
}

export function isEventSettings(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  if (s.people !== undefined && !isPeopleSettings(s.people, s.kind)) return false;
  switch (s.kind) {
    case "single":
      return (
        int(s.durationMinutes, 1, 24 * 60) &&
        int(s.startHour, 0, 23) &&
        (s.anyTime === undefined || typeof s.anyTime === "boolean") &&
        (s.allowedDays === undefined ||
          (Array.isArray(s.allowedDays) &&
            s.allowedDays.length <= 7 &&
            s.allowedDays.every((d) => int(d, 0, 6))))
      );
    case "trip": {
      const shape = s.shape as Record<string, unknown> | undefined;
      return (
        !!shape &&
        typeof shape === "object" &&
        int(shape.anchorDow, 0, 6) &&
        int(shape.spanDays, 1, 7) &&
        int(shape.startHour, 0, 23) &&
        int(shape.endHour, 0, 24)
      );
    }
    case "vacation":
      return int(s.days, 1, 30);
    default:
      return false;
  }
}

/**
 * A date as sent by a browser, or null if it isn't one worth storing: both
 * ends valid ISO instants, the end after the start and not already over, no
 * longer than a month, and within the year or so the app searches.
 */
export function parseEventDate(
  raw: unknown,
  now = Date.now(),
): { start: string; end: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { start, end } = raw as Record<string, unknown>;
  if (typeof start !== "string" || typeof end !== "string") return null;
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  if (e <= s || e <= now || e - s > MAX_SPAN_MS || s > now + MAX_AHEAD_MS) return null;
  return { start: new Date(s).toISOString(), end: new Date(e).toISOString() };
}

/** An event title as it should be stored, or null if nothing is left of it. */
export function cleanEventTitle(raw: unknown): string | null {
  return cleanText(raw, MAX_EVENT_TITLE_LENGTH);
}

/** Longest place and note kept (#84), matching the table's check constraints. */
export const MAX_PLACE_LENGTH = 100;
export const MAX_NOTE_LENGTH = 500;

/**
 * An event's place or note as it should be stored: tidied like a title, null
 * when empty or missing (it is optional). Undefined only when `raw` is
 * something no browser of ours sends, which the caller refuses.
 */
export function cleanEventDetail(raw: unknown, maxLength: number): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return undefined;
  return cleanText(raw, maxLength);
}

/** The most dates one vote may offer: what anyone swipes through in one go. */
export const MAX_CANDIDATES = 10;

/** How long a vote waits for everyone's answers before deciding with what it has. */
export const VOTE_ANSWER_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The days a vote waits for answers (#99), as the suggester chose them: a
 * whole number from 1 to 7. Missing means the usual 3 days (a page loaded
 * before this); anything else is null, refused by the caller.
 */
export function voteAnswerMs(raw: unknown): number | null {
  if (raw === undefined) return VOTE_ANSWER_MS;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 7) return null;
  return raw * 24 * 60 * 60 * 1000;
}

/**
 * A vote's candidate dates as sent by a browser, or null if they aren't worth
 * storing: one to MAX_CANDIDATES dates, each one parseEventDate keeps, none
 * starting at the same moment as another. Sorted by start.
 */
export function parseCandidateDates(
  raw: unknown,
  now = Date.now(),
): { start: string; end: string }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CANDIDATES) return null;
  const dates: { start: string; end: string }[] = [];
  for (const item of raw) {
    const date = parseEventDate(item, now);
    if (!date || dates.some((d) => d.start === date.start)) return null;
    dates.push(date);
  }
  return dates.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** An event's way of offering dates: one at a time, or several to vote on (#74). */
export type EventMode = "single" | "vote";

/**
 * The date on offer, as the database's event_current_date says: for a vote,
 * the date chosen (none until it is decided); otherwise the newest one nobody
 * declined, null once every date was declined. A chosen date wins either way,
 * so callers that only see scheduled events need not know the mode.
 */
export function currentDate<
  D extends { declined_at: string | null; created_at: string; chosen_at?: string | null },
>(dates: D[], mode: EventMode = "single"): D | null {
  const chosen = dates.find((d) => d.chosen_at);
  if (chosen) return chosen;
  if (mode === "vote") return null;
  return dates
    .filter((d) => d.declined_at === null)
    .reduce<D | null>(
      (newest, d) =>
        !newest || Date.parse(d.created_at) > Date.parse(newest.created_at) ? d : newest,
      null,
    );
}
