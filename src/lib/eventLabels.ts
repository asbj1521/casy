/**
 * Event labels (#112), the app's half: which of this phone's events still
 * need a label, and the labels kept on the phone. The server
 * (calendar-label, _shared/labelAi.ts) only labels what it is sent and keeps
 * nothing; this phone sends each distinct title once and remembers the
 * answer, so reopening the app costs nothing and only new titles are asked
 * about.
 *
 * A label belongs to a title in a calendar ("Eksamen" in "Uni"), not to one
 * occurrence: a weekly lecture is labelled once. It is kept under a hash of
 * the two, so the labels hold no readable copy of any title (the calendar
 * view reads titles from the phone afresh each time, #110). The hash isn't a
 * secret, only a way not to keep the text.
 *
 * The person's corrections ("Forkert?") are kept too, with the title and
 * what they wrote, and go along with every later call, so what they said
 * about their own life carries over to events like it; a correction also
 * marks the other labels in its calendar stale, to be labelled again with it
 * in hand. They are their own words about their own events, and like
 * everything here they stay on the phone and go with signing out.
 *
 * Pure, apart from the storage at the bottom.
 */
import type { EventLabel, EventToLabel } from "@/api/eventLabels";
import { busySpan } from "@/lib/phoneBusy";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import { readStored, writeStored } from "@/lib/storage";
import { APP_TIME_ZONE, offsetAt } from "@/lib/zone";

/** Titles sent per call: the server's limit (MAX_EVENTS in labelAi.ts). */
export const BATCH_SIZE = 50;
/** Labelled per run at most, soonest first; the rest wait for the next. */
export const MAX_PER_RUN = 300;
/** Events that ended longer ago than this aren't labelled. */
const LOOK_BACK_MS = 7 * 86_400_000;

/** A label as this phone keeps it. */
export interface StoredLabel extends EventLabel {
  /** How often the title occurred when it was labelled, sent again with a correction. */
  count: number;
  /** Labelled again from the person's own correction ("Forkert?"): never replaced. */
  corrected?: boolean;
  /** The phone calendar (EventKit id) it belongs to, so a correction can reach its neighbours. */
  calendarId?: string;
  /** To be labelled again: a correction in its calendar came after it. */
  stale?: boolean;
}

/** One of the person's corrections, kept to send with later calls. */
export interface LabelCorrection {
  key: string;
  calendarId: string;
  title: string;
  /** The calendar's name, as sent. */
  calendar: string;
  /** What they wrote. */
  note: string;
  /** The label it got from their note. */
  label: EventLabel;
  at: number;
}

export type LabelBook = Record<string, StoredLabel>;

/** One distinct title in one calendar, ready to send. */
export interface LabelCandidate {
  key: string;
  /** Its phone calendar (EventKit id). */
  calendarId: string;
  event: EventToLabel;
  /** When it next happens (or last did): soonest are labelled first. */
  next: number;
}

/** A title as compared: case, spacing and surrounding spaces don't matter. */
function normalise(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * cyrb53, a small, fast 53-bit string hash: enough to tell a few thousand
 * titles apart without keeping them. Not cryptographic, and needn't be.
 */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Where a title's label is kept: its phone calendar (EventKit id) and the title. */
export function labelKey(calendarExternalId: string, title: string): string {
  return hash(`${calendarExternalId}\n${normalise(title)}`);
}

const MINUTE_MS = 60_000;

/** Minutes after midnight on the clock, Danish time (09:00 is 540 on a DST day too). */
export function clockMinute(ms: number): number {
  const local = ms + offsetAt(ms, APP_TIME_ZONE);
  return Math.floor(local / MINUTE_MS) % (24 * 60);
}

/**
 * The distinct titles among this phone's events, one per title and
 * calendar, with how often each occurs and its next occurrence's timing.
 * Only events that count as busy (busySpan) in the calendars given (EventKit
 * id to the calendar's name), and not ones that ended over a week ago.
 * Soonest first, so what is coming up is labelled before what is far off.
 */
export function labelCandidates(
  events: PhoneEventWithDetails[],
  calendarNames: Map<string, string>,
  now: number,
): LabelCandidate[] {
  const byKey = new Map<string, LabelCandidate>();
  for (const e of events) {
    const name = calendarNames.get(e.calendarId);
    const title = e.title?.trim();
    const span = busySpan(e);
    if (name === undefined || !title || !span || span.end < now - LOOK_BACK_MS) continue;
    const key = labelKey(e.calendarId, title);
    const known = byKey.get(key);
    if (known) {
      known.event.count += 1;
      // The occurrence nearest to now (the next one, or the latest past one)
      // gives the timing sent.
      if (Math.abs(span.start - now) >= Math.abs(known.next - now)) continue;
    }
    const days = Math.max(1, Math.round((span.end - span.start) / 86_400_000));
    byKey.set(key, {
      key,
      calendarId: e.calendarId,
      next: span.start,
      event: {
        title,
        calendar: name,
        allDay: e.allDay,
        startMinute: e.allDay ? 0 : clockMinute(span.start),
        minutes: e.allDay ? 0 : Math.round((span.end - span.start) / MINUTE_MS),
        days: e.allDay ? days : 1,
        count: known?.event.count ?? 1,
      },
    });
  }
  // Past ones (within the week) after everything still to come.
  const rank = (c: LabelCandidate) => (c.next >= now - 86_400_000 ? c.next : Infinity);
  return [...byKey.values()].sort((a, b) => rank(a) - rank(b) || b.next - a.next);
}

/**
 * Candidates with no label yet, or a stale one, and not already asked about
 * this launch, in batches for the server.
 */
export function batchesToLabel(
  candidates: LabelCandidate[],
  book: LabelBook,
  asked: Set<string>,
): LabelCandidate[][] {
  const wanted = candidates
    .filter((c) => (!book[c.key] || book[c.key].stale) && !asked.has(c.key))
    .slice(0, MAX_PER_RUN);
  const batches: LabelCandidate[][] = [];
  for (let i = 0; i < wanted.length; i += BATCH_SIZE) {
    batches.push(wanted.slice(i, i + BATCH_SIZE));
  }
  return batches;
}

/**
 * The book with new labels added (a correction is never overwritten by a
 * background label), and, when `present` is given (every key the phone
 * still has), without labels whose event is gone.
 */
export function updateBook(
  book: LabelBook,
  added: { key: string; label: StoredLabel }[],
  present?: Set<string>,
): LabelBook {
  const next: LabelBook = {};
  for (const [key, label] of Object.entries(book)) {
    if (!present || present.has(key)) next[key] = label;
  }
  for (const { key, label } of added) {
    if (next[key]?.corrected && !label.corrected) continue;
    next[key] = label;
  }
  return next;
}

/**
 * The book tidied against the phone's events as they are: labels whose
 * event is gone dropped, and the calendar filled in on labels from before it
 * was kept. The same book (unchanged) when there is nothing to tidy, so a
 * caller can tell whether to save.
 */
export function tidyBook(
  book: LabelBook,
  present: Set<string>,
  candidates: LabelCandidate[],
): LabelBook {
  const calendarOf = new Map(candidates.map((c) => [c.key, c.calendarId]));
  let changed = false;
  const next: LabelBook = {};
  for (const [key, label] of Object.entries(book)) {
    if (!present.has(key)) {
      changed = true;
      continue;
    }
    const calendarId = label.calendarId ?? calendarOf.get(key);
    if (calendarId !== label.calendarId) {
      changed = true;
      next[key] = { ...label, calendarId };
    } else next[key] = label;
  }
  return changed ? next : book;
}

/**
 * After a correction in `calendarId`: every other label there that isn't
 * the person's own becomes stale, to be labelled again with the correction
 * in hand. Returns the keys marked.
 */
export function markCalendarStale(
  book: LabelBook,
  calendarId: string,
): { book: LabelBook; keys: string[] } {
  const keys: string[] = [];
  const next: LabelBook = {};
  for (const [key, label] of Object.entries(book)) {
    if (label.calendarId === calendarId && !label.corrected) {
      keys.push(key);
      next[key] = { ...label, stale: true };
    } else next[key] = label;
  }
  return { book: next, keys };
}

/** Every key among the phone's events (labelled or not): what may be kept. */
export function presentKeys(events: PhoneEventWithDetails[]): Set<string> {
  const keys = new Set<string>();
  for (const e of events) {
    const title = e.title?.trim();
    if (title) keys.add(labelKey(e.calendarId, title));
  }
  return keys;
}

/** Corrections kept, the most recent first; as many as the server takes (MAX_CORRECTIONS). */
export const MAX_CORRECTIONS = 30;

/** The corrections with a new one first, replacing an earlier one for the same event. */
export function addCorrection(
  corrections: LabelCorrection[],
  correction: LabelCorrection,
): LabelCorrection[] {
  return [correction, ...corrections.filter((c) => c.key !== correction.key)].slice(
    0,
    MAX_CORRECTIONS,
  );
}

/** The corrections as the server takes them. */
export function correctionsToSend(corrections: LabelCorrection[]) {
  return corrections.map(({ title, calendar, note, label }) => ({ title, calendar, note, label }));
}

/* ----------------------------------------------------------------------------
 * Kept on the phone, per account; gone on sign-out (AuthProvider).
 * ------------------------------------------------------------------------- */

const STORAGE_PREFIX = "casy-event-labels:";
const CORRECTIONS_PREFIX = "casy-label-corrections:";

export function readLabelBook(userId: string): LabelBook {
  const raw = readStored(STORAGE_PREFIX + userId);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { v?: number; labels?: LabelBook };
    return parsed.v === 1 && parsed.labels && typeof parsed.labels === "object"
      ? parsed.labels
      : {};
  } catch {
    return {};
  }
}

export function writeLabelBook(userId: string, book: LabelBook): void {
  writeStored(STORAGE_PREFIX + userId, JSON.stringify({ v: 1, labels: book }));
}

export function readCorrections(userId: string): LabelCorrection[] {
  const raw = readStored(CORRECTIONS_PREFIX + userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { v?: number; corrections?: LabelCorrection[] };
    return parsed.v === 1 && Array.isArray(parsed.corrections) ? parsed.corrections : [];
  } catch {
    return [];
  }
}

export function writeCorrections(userId: string, corrections: LabelCorrection[]): void {
  writeStored(CORRECTIONS_PREFIX + userId, JSON.stringify({ v: 1, corrections }));
}

/** Every account's labels and corrections on this phone, on sign-out. */
export function clearLabelBooks(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const name = localStorage.key(i);
      if (name?.startsWith(STORAGE_PREFIX) || name?.startsWith(CORRECTIONS_PREFIX)) {
        localStorage.removeItem(name);
      }
    }
  } catch {
    // Nothing stored, then.
  }
}
