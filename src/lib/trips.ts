/**
 * Trip detection (#115): a flight out and a flight home mean someone is away
 * in between, though their calendar only holds two short blocks. This pairs
 * the legs of a journey (flights, trains, buses) into trips that block like a
 * holiday (an `away` entry, never skipped).
 *
 * A leg is one such event with the cities it goes between, read from its
 * title and place by the `trip-legs` skill on the phone. The cities never
 * leave the phone. Everything here is plain code over legs, so the same legs
 * give the same trips every time.
 *
 * The rule throughout is that Casy asks. A wrong trip silently costs a person
 * dates, so nothing blocks until the person accepts it: a detected trip is a
 * suggestion, drawn in their calendar for them to accept or decline, and only
 * an accepted one counts. When the legs don't make a pair, Casy asks:
 *  - a way out with no way back (the flight to Norway, the drive home), or a
 *    way back with no way out, becomes a question: when are you back, when did
 *    you leave? The answer, a day, ends or starts the trip, and is the
 *    person's own say-so, so that trip needs no further accept;
 *  - which city is home is asked when the legs don't say (a single round trip
 *    looks the same from both ends);
 *  - journeys that are routine (a weekly train), that never cross a midnight
 *    (a day trip), or that run past MAX_TRIP_DAYS are not trips.
 *
 * Pure: legs and answers go in, trips and questions come out.
 */
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

type LegMode = "flight" | "train" | "bus";

/** One flight, train or bus event with the cities it runs between. */
export interface Leg {
  /** Stable for the event, so an answer or a dismissal sticks to it. */
  id: string;
  mode: LegMode;
  /** City keys (cityKey): where it leaves from and arrives. */
  from: string;
  to: string;
  /** Epoch ms. */
  start: number;
  end: number;
  /** How often this title occurs in the calendar read: a commute occurs a lot. */
  count: number;
  /** The cities as written ("Copenhagen"), for showing; `from` and `to` are for comparing. */
  names?: { from: string; to: string };
}

/** What the person has told Casy about their trips, kept on the phone. */
export interface TripAnswers {
  /** The home city (a city key), once known. */
  home?: string;
  /** Leg id of a way out with no way back, to the day the person is back (a local midnight). */
  returns: Record<string, number>;
  /** Leg id of a way back with no way out, to the day the person left (a local midnight). */
  outbounds: Record<string, number>;
  /** Ids of detected trips the person accepted: only these count. */
  accepted: string[];
  /** Ids the person declined, or deleted after accepting: never suggested again. */
  dismissed: string[];
  /**
   * Each accepted trip as it was, by id: kept so it stays in the calendar
   * whatever happens to the legs it came from (re-read, or the calendar
   * reconnected), and, once it is in the phone's own calendar, that event.
   */
  kept: Record<string, KeptTrip>;
}

/** An accepted trip, saved as itself. */
interface KeptTrip {
  start: number;
  end: number;
  /** The city it is named by, as shown when it was accepted. */
  city: string;
  /** The event it was written as in the phone's calendar, once it was. */
  eventId?: string;
}

export const NO_ANSWERS: TripAnswers = {
  returns: {},
  outbounds: {},
  accepted: [],
  dismissed: [],
  kept: {},
};

/** A trip: away from the first departure to the last arrival. */
export interface Trip {
  /** The id of its first leg. */
  id: string;
  start: number;
  end: number;
  legs: Leg[];
  /** The person gave one end of it (a day), rather than every leg being in the calendar. */
  answered: boolean;
  /** The person said yes to it (an answered trip is their own word): only this blocks. */
  accepted: boolean;
  /** Only for a trip kept after its legs were gone: the city it is named by. */
  city?: string;
  /** It was written into the phone's own calendar. */
  inCalendar?: true;
}

/** What Casy asks when it is in doubt. */
export type Question =
  /** Legs don't say where home is: which of these? `legs` are the next journey, to point at. */
  | { kind: "home"; id: string; legs: Leg[]; cities: string[] }
  /** A way out with no way back: when are you back? */
  | { kind: "return"; id: string; legs: Leg[]; earliest: number; latest: number | null }
  /** A way back with no way out: when did you leave? */
  | { kind: "outbound"; id: string; legs: Leg[]; earliest: number | null; latest: number };

export interface Detected {
  /** Every trip found, accepted or not. */
  trips: Trip[];
  questions: Question[];
}

/** From this many occurrences a title is a routine (a weekly train), not a journey. */
export const ROUTINE_COUNT = 4;
/** A longer stretch between a way out and a way back isn't taken as one trip. */
export const MAX_TRIP_DAYS = 60;
/** Legs this close, one arriving where the next leaves, are one journey (a connection). */
const CONNECTION_MS = 12 * 3_600_000;
/**
 * A leg longer than this is no journey: a flight, train or bus doesn't take a
 * day and a half. A hand-written "travel to Oslo" spanning the whole stay is
 * the stay itself, which the calendar already blocks (#165).
 */
const MAX_LEG_MS = 36 * 3_600_000;
/** A way out with no way back is only asked about while it is recent or to come. */
const ASK_AFTER_MS = 3 * 86_400_000;

const DAY_MS = 86_400_000;

/** A city as compared: case, accents and surrounding spaces don't matter ("København" = "kobenhavn"). */
export function cityKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .replace(/å/gi, "a")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** One or more legs of a connection, travelled as one journey. */
interface Segment {
  id: string;
  from: string;
  to: string;
  start: number;
  end: number;
  legs: Leg[];
}

/** Legs that connect (one arrives where the next leaves, within CONNECTION_MS) as one segment each. */
function segmentsOf(legs: Leg[]): Segment[] {
  const segments: Segment[] = [];
  for (const leg of legs) {
    const last = segments[segments.length - 1];
    // Never joined into a loop: a quick there-and-back is two segments, so
    // the overnight rule can judge it.
    if (
      last &&
      last.to === leg.from &&
      leg.to !== last.from &&
      leg.start - last.end >= 0 &&
      leg.start - last.end <= CONNECTION_MS
    ) {
      last.to = leg.to;
      last.end = leg.end;
      last.legs.push(leg);
    } else {
      segments.push({
        id: leg.id,
        from: leg.from,
        to: leg.to,
        start: leg.start,
        end: leg.end,
        legs: [leg],
      });
    }
  }
  return segments;
}

/**
 * Where the legs say home is: the city most journeys start or end in. Null
 * when no city leads (a single round trip, which could be made from either
 * end), and the person is asked.
 */
function inferHome(segments: Segment[]): string | null {
  const score = new Map<string, number>();
  for (const s of segments) {
    for (const city of new Set([s.from, s.to])) score.set(city, (score.get(city) ?? 0) + 1);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1])
    ? ranked[0][0]
    : null;
}

/** The cities worth offering as home: those that lead the count, at most three. */
function homeCandidates(segments: Segment[]): string[] {
  const score = new Map<string, number>();
  for (const s of segments) {
    for (const city of new Set([s.from, s.to])) score.set(city, (score.get(city) ?? 0) + 1);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;
  return ranked
    .filter(([, n]) => n === top)
    .slice(0, 3)
    .map(([city]) => city);
}

/** The legs that can be part of a trip (no routines, nothing going nowhere), in time order. */
function usable(legs: Leg[]): Leg[] {
  return legs
    .filter(
      (l) =>
        l.count < ROUTINE_COUNT &&
        l.end > l.start &&
        l.end - l.start <= MAX_LEG_MS &&
        l.from !== l.to,
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Home, as the person said or the legs say; null while neither does. The
 * phone needs it before pairing, to read "the way home" and a way out that
 * doesn't name where it leaves from.
 */
export function homeOf(legs: Leg[], answers: TripAnswers): string | null {
  return answers.home ?? inferHome(segmentsOf(usable(legs)));
}

/**
 * The trips found, plus every accepted trip kept that they no longer include
 * (its legs gone or not read yet), as it was when accepted. Soonest first.
 */
function withKept(trips: Trip[], answers: TripAnswers): Trip[] {
  const found = new Set(trips.map((t) => t.id));
  const skipped = new Set(answers.dismissed);
  const kept = Object.entries(answers.kept)
    .filter(([id]) => !found.has(id) && !skipped.has(id))
    .map(([id, k]) => ({
      id,
      start: k.start,
      end: k.end,
      legs: [],
      answered: true,
      accepted: true,
      city: k.city,
    }));
  const all = kept.length === 0 ? trips : [...trips, ...kept].sort((a, b) => a.start - b.start);
  return all.map((t) => (answers.kept[t.id]?.eventId ? { ...t, inCalendar: true as const } : t));
}

/** Whether a stretch crosses a local midnight: a day trip is not away. */
function staysOvernight(start: number, end: number): boolean {
  return end > addDays(start, 1, APP_TIME_ZONE);
}

/**
 * The trips in a person's legs, and what to ask about the rest. `now` only
 * decides which loose ends are still worth a question. `inCalendar` are the
 * trips Casy already wrote into the calendar (their entries' spans): with the
 * trips kept as accepted, a journey starting inside one is settled, so it is
 * neither asked about nor suggested again. The calendar is the record that
 * survives when the answers on the phone are gone (the app installed again,
 * signed out) or a flight's id moved (#165).
 */
export function detectTrips(
  allLegs: Leg[],
  answers: TripAnswers,
  now: number,
  inCalendar: { start: number; end: number }[] = [],
): Detected {
  const segments = segmentsOf(usable(allLegs));
  if (segments.length === 0) return { trips: withKept([], answers), questions: [] };

  const home = answers.home ?? inferHome(segments);
  if (!home) {
    // Nothing is asked about journeys that are over.
    const next = segments.find((s) => s.end > now);
    return {
      trips: withKept([], answers),
      questions: next
        ? [{ kind: "home", id: next.id, legs: next.legs, cities: homeCandidates(segments) }]
        : [],
    };
  }

  const trips: Trip[] = [];
  const questions: Question[] = [];
  const skipped = new Set(answers.dismissed);
  const settled = [...inCalendar, ...Object.values(answers.kept)];
  const isSettled = (t: number) => settled.some((s) => t >= s.start && t < s.end);
  // When the person last got home, as far as the legs say: no way out is
  // offered from before it.
  let lastHome: number | null = null;

  /** A way out with no way back: the person's answer ends it, or a question asks. */
  const unpaired = (open: Segment[], latest: number | null) => {
    const first = open[0];
    const last = open[open.length - 1];
    if (skipped.has(first.id)) return;
    const day = answers.returns[first.id];
    if (day !== undefined) {
      trips.push({
        id: first.id,
        start: first.start,
        end: Math.max(last.end, addDays(day, 1, APP_TIME_ZONE)),
        legs: open.flatMap((s) => s.legs),
        answered: true,
        accepted: true,
      });
    } else if (last.end > now - ASK_AFTER_MS && !isSettled(first.start)) {
      questions.push({
        kind: "return",
        id: first.id,
        legs: open.flatMap((s) => s.legs),
        earliest: addDays(last.end, 1, APP_TIME_ZONE),
        latest,
      });
    }
  };

  let open: Segment[] | null = null;
  for (const seg of segments) {
    if (open) {
      const tooLong = seg.start - open[0].start > MAX_TRIP_DAYS * DAY_MS;
      if (tooLong) {
        unpaired(open, null);
        open = null;
      } else if (seg.from === home) {
        // Home again without a leg to say so (driven, say): the way back is missing.
        unpaired(open, seg.start);
        open = [seg];
        continue;
      } else {
        open.push(seg);
        if (seg.to === home) {
          const first = open[0];
          const accepted = answers.accepted.includes(first.id);
          if (
            !skipped.has(first.id) &&
            staysOvernight(first.start, seg.end) &&
            (accepted || !isSettled(first.start))
          ) {
            trips.push({
              id: first.id,
              start: first.start,
              end: seg.end,
              legs: open.flatMap((s) => s.legs),
              answered: false,
              accepted,
            });
          }
          lastHome = seg.end;
          open = null;
        }
        continue;
      }
    }
    if (seg.from === home) {
      open = [seg];
    } else if (seg.to === home) {
      // A way back with no way out.
      if (skipped.has(seg.id)) continue;
      const day = answers.outbounds[seg.id];
      if (day !== undefined) {
        trips.push({
          id: seg.id,
          start: Math.min(seg.start, startOfDay(day, APP_TIME_ZONE)),
          end: seg.end,
          legs: seg.legs,
          answered: true,
          accepted: true,
        });
      } else if (seg.end > now && !isSettled(seg.start)) {
        questions.push({
          kind: "outbound",
          id: seg.id,
          legs: seg.legs,
          earliest: lastHome === null ? null : startOfDay(lastHome, APP_TIME_ZONE),
          latest: addDays(seg.start, -1, APP_TIME_ZONE),
        });
      }
      lastHome = seg.end;
    }
    // From one far place to another, outside any trip: nothing to say about it.
  }
  if (open) unpaired(open, null);
  return { trips: withKept(trips, answers), questions };
}

/**
 * The days to offer for a question, each a local midnight, soonest first for a
 * way back and latest first for a way out (the day before the way back is the
 * likeliest). At most MAX_TRIP_DAYS (as long as a trip may be), within the question's bounds.
 */
export function dayOptions(question: Exclude<Question, { kind: "home" }>, now: number): number[] {
  const days: number[] = [];
  if (question.kind === "return") {
    const first = Math.max(
      startOfDay(question.earliest, APP_TIME_ZONE),
      startOfDay(now, APP_TIME_ZONE),
    );
    for (let i = 0; i < MAX_TRIP_DAYS; i++) {
      const day = addDays(first, i, APP_TIME_ZONE);
      if (question.latest !== null && day > startOfDay(question.latest, APP_TIME_ZONE)) break;
      days.push(day);
    }
  } else {
    const last = startOfDay(question.latest, APP_TIME_ZONE);
    for (let i = 0; i < MAX_TRIP_DAYS; i++) {
      const day = addDays(last, -i, APP_TIME_ZONE);
      if (question.earliest !== null && day < question.earliest) break;
      days.push(day);
    }
  }
  return days;
}
