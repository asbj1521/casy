/**
 * Trip detection (#115), the app's half: which of this phone's events are
 * worth reading as a journey, the legs read from them (`trip-legs`), and the
 * legs as trips.ts takes them. Like the labels (#112), everything here stays
 * on the phone: the legs with their cities, and what the person answered
 * about their trips.
 *
 * Only events the labels call a flight or travel are sent, each distinct
 * title and place in a calendar once. A leg belongs to that title and place,
 * like a label to its title; each occurrence of it is a leg of its own in
 * trips.ts, at its own time.
 *
 * Pure, apart from the storage at the bottom.
 */
import { HOME, type EventToRead, type TripLeg } from "@/api/tripLegs";
import { isCasyTripEntry } from "@/lib/casyTripEntry";
import { hash, labelKey, LOOK_BACK_MS, normalise, type LabelBook } from "@/lib/eventLabels";
import { busySpan } from "@/lib/phoneBusy";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import { readStored, writeStored } from "@/lib/storage";
import { cityKey, homeOf, NO_ANSWERS, type Leg, type TripAnswers } from "@/lib/trips";

/** Events sent per call: under the server's limit, so an answer never runs long (as labels did). */
export const BATCH_SIZE = 20;
/** Read per run at most, soonest first; the rest wait for the next. */
export const MAX_PER_RUN = 150;

/** What the labels call a journey worth reading. */
const TRAVEL_KINDS = new Set(["flight", "travel"]);

export type LegBook = Record<string, TripLeg>;

/** One distinct travel event in one calendar, ready to send. */
export interface LegCandidate {
  key: string;
  event: EventToRead;
  /** When it next happens (or last did): soonest are read first. */
  next: number;
}

/** Where a leg is kept: its phone calendar, title and place. */
export function legKey(calendarId: string, title: string, location: string): string {
  return hash(`${calendarId}\n${normalise(title)}\n${normalise(location)}`);
}

/**
 * An event's title and place, and whether the labels call it a journey; null
 * if they don't. Never a trip Casy wrote into the calendar itself (#154).
 */
function travelOf(e: PhoneEventWithDetails, labels: LabelBook) {
  const title = e.title?.trim();
  if (!title || isCasyTripEntry(e)) return null;
  const label = labels[labelKey(e.calendarId, title)];
  if (!label || !TRAVEL_KINDS.has(label.kind)) return null;
  const location = e.location?.trim() ?? "";
  return { title, location, key: legKey(e.calendarId, title, location) };
}

/**
 * The distinct travel events among this phone's events, in the calendars
 * that count (EventKit id to the calendar's name), not ended over a week
 * ago. Soonest first.
 */
export function travelCandidates(
  events: PhoneEventWithDetails[],
  labels: LabelBook,
  calendarNames: Map<string, string>,
  now: number,
): LegCandidate[] {
  const byKey = new Map<string, LegCandidate>();
  for (const e of events) {
    const name = calendarNames.get(e.calendarId);
    const travel = travelOf(e, labels);
    const span = busySpan(e);
    if (name === undefined || !travel || !span || span.end < now - LOOK_BACK_MS) continue;
    const known = byKey.get(travel.key);
    if (known && Math.abs(span.start - now) >= Math.abs(known.next - now)) continue;
    byKey.set(travel.key, {
      key: travel.key,
      next: span.start,
      event: { title: travel.title, location: travel.location, calendar: name, allDay: e.allDay },
    });
  }
  const rank = (c: LegCandidate) => (c.next >= now - 86_400_000 ? c.next : Infinity);
  return [...byKey.values()].sort((a, b) => rank(a) - rank(b) || b.next - a.next);
}

/** Candidates not read yet and not already asked about this launch, in batches. */
export function legBatches(
  candidates: LegCandidate[],
  book: LegBook,
  asked: Set<string>,
): LegCandidate[][] {
  const wanted = candidates.filter((c) => !book[c.key] && !asked.has(c.key)).slice(0, MAX_PER_RUN);
  const batches: LegCandidate[][] = [];
  for (let i = 0; i < wanted.length; i += BATCH_SIZE) batches.push(wanted.slice(i, i + BATCH_SIZE));
  return batches;
}

/**
 * Every leg key among the phone's travel events, whichever calendar they are in
 * and whatever the server lists: what may be kept. Not the candidates, which
 * only count calendars the server lists for this phone's connection: with that
 * connection removed it lists none, and every leg was dropped (#132).
 */
export function presentLegKeys(events: PhoneEventWithDetails[], labels: LabelBook): Set<string> {
  const keys = new Set<string>();
  for (const e of events) {
    const travel = travelOf(e, labels);
    if (travel) keys.add(travel.key);
  }
  return keys;
}

/** The book with legs whose event is gone dropped; the same book when nothing is. */
export function tidyLegBook(book: LegBook, present: Set<string>): LegBook {
  const kept = Object.entries(book).filter(([key]) => present.has(key));
  return kept.length === Object.keys(book).length ? book : Object.fromEntries(kept);
}

interface Occurrence {
  key: string;
  start: number;
  end: number;
  leg: TripLeg;
}

/**
 * This phone's travel events as legs for trips.ts: every occurrence of a
 * read leg that is a flight, train or bus, read with some confidence. Cities
 * the title doesn't name are filled in from home once it is known: "the way
 * home" is home, and a journey naming only where it goes leaves from home
 * (and one naming only where it leaves, unless that is home, goes home).
 * Those are guesses, but every trip waits for the person's accept anyway.
 * A journey naming neither city is left out.
 */
export function phoneLegs(
  events: PhoneEventWithDetails[],
  labels: LabelBook,
  book: LegBook,
  calendarNames: Map<string, string>,
  answers: TripAnswers,
): Leg[] {
  const occurrences: Occurrence[] = [];
  const counts = new Map<string, number>();
  // An accepted trip's own entry, whatever its note now says: exactly a kept trip's times.
  const keptSpans = new Set(Object.values(answers.kept).map((k) => `${k.start}-${k.end}`));
  for (const e of events) {
    if (!calendarNames.has(e.calendarId)) continue;
    const travel = travelOf(e, labels);
    const span = busySpan(e);
    if (span && keptSpans.has(`${span.start}-${span.end}`)) continue;
    const leg = travel ? book[travel.key] : undefined;
    if (!travel || !span || !leg || leg.mode === "none" || leg.confidence === "low") continue;
    counts.set(travel.key, (counts.get(travel.key) ?? 0) + 1);
    occurrences.push({ key: travel.key, start: span.start, end: span.end, leg });
  }
  const named = (city: string) => city !== "" && city !== HOME;
  const toLeg = (o: Occurrence, from: string, to: string): Leg => ({
    id: `${o.key}@${o.start}`,
    mode: o.leg.mode as Leg["mode"],
    from: cityKey(from),
    to: cityKey(to),
    start: o.start,
    end: o.end,
    count: counts.get(o.key) ?? 1,
    names: { from, to },
  });

  const complete = occurrences
    .filter((o) => named(o.leg.from) && named(o.leg.to))
    .map((o) => toLeg(o, o.leg.from, o.leg.to));
  const home = homeOf(complete, answers);
  if (home === null) return complete;

  const filled: Leg[] = [];
  for (const o of occurrences) {
    if (named(o.leg.from) && named(o.leg.to)) continue;
    const from = o.leg.from === HOME ? home : o.leg.from;
    const to = o.leg.to === HOME ? home : o.leg.to;
    if (from === "" && to === "") continue;
    if (from === "") filled.push(toLeg(o, home, to));
    else if (to === "") {
      if (cityKey(from) !== home) filled.push(toLeg(o, from, home));
    } else filled.push(toLeg(o, from, to));
  }
  return [...complete, ...filled];
}

/* ----------------------------------------------------------------------------
 * Kept on the phone, per account; gone on sign-out and with the AI's consent
 * (clearLabelsFor and clearLabelBooks in eventLabels.ts take these too).
 * ------------------------------------------------------------------------- */

export const LEGS_PREFIX = "casy-trip-legs:";
export const ANSWERS_PREFIX = "casy-trip-answers:";

export function readLegBook(userId: string): LegBook {
  try {
    const parsed = JSON.parse(readStored(LEGS_PREFIX + userId) ?? "") as {
      v?: number;
      legs?: LegBook;
    };
    return parsed.v === 1 && parsed.legs && typeof parsed.legs === "object" ? parsed.legs : {};
  } catch {
    return {};
  }
}

export function writeLegBook(userId: string, book: LegBook): void {
  writeStored(LEGS_PREFIX + userId, JSON.stringify({ v: 1, legs: book }));
}

export function readTripAnswers(userId: string): TripAnswers {
  try {
    const parsed = JSON.parse(readStored(ANSWERS_PREFIX + userId) ?? "") as {
      v?: number;
      answers?: Partial<TripAnswers>;
    };
    const a = parsed.v === 1 ? parsed.answers : undefined;
    if (!a || typeof a !== "object") return NO_ANSWERS;
    return {
      home: typeof a.home === "string" ? a.home : undefined,
      returns: a.returns && typeof a.returns === "object" ? a.returns : {},
      outbounds: a.outbounds && typeof a.outbounds === "object" ? a.outbounds : {},
      accepted: Array.isArray(a.accepted) ? a.accepted : [],
      dismissed: Array.isArray(a.dismissed) ? a.dismissed : [],
      kept: a.kept && typeof a.kept === "object" ? a.kept : {},
    };
  } catch {
    return NO_ANSWERS;
  }
}

export function writeTripAnswers(userId: string, answers: TripAnswers): void {
  writeStored(ANSWERS_PREFIX + userId, JSON.stringify({ v: 1, answers }));
}
