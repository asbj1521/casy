/**
 * Trip detection (#115) on My calendar: what trips.ts found, as marks on the
 * month. Each mark is either a trip (waiting for the person's yes, or
 * accepted) or something Casy asks about, with the days it covers and the
 * city to name it by. Pure, so where a mark sits and what it says are tested.
 */
import type { Messages } from "@/i18n/da";
import type { Lang } from "@/i18n/locale";
import { CASY_CALENDAR_ID } from "@/lib/casyEntries";
import type { GridItem } from "@/lib/monthGrid";
import type { Detected, Leg, Question, Trip } from "@/lib/trips";
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

export type TripMark =
  | { kind: "trip"; id: string; trip: Trip; start: number; end: number; city: string }
  | {
      kind: "question";
      id: string;
      question: Question & { legs: Leg[] };
      start: number;
      end: number;
      city: string;
    };

/** Whether the person still has to answer it: a trip not yet accepted, or a question. */
export function isPending(mark: TripMark): boolean {
  return mark.kind === "question" || !mark.trip.accepted;
}

/** The cities as written ("Copenhagen") by their keys, from every leg that says. */
function cityNames(legs: Leg[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const leg of legs) {
    if (!leg.names) continue;
    // A city filled in from home carries its key, not a name: a real one wins.
    if (leg.names.from !== leg.from || !names.has(leg.from)) names.set(leg.from, leg.names.from);
    if (leg.names.to !== leg.to || !names.has(leg.to)) names.set(leg.to, leg.names.to);
  }
  return names;
}

/**
 * Cities whose Danish name isn't their English one, by key: the AI writes
 * cities in English so the same city always compares equal, and a Danish
 * page says them the Danish way. Checked by hand; a city not here is said as
 * the AI wrote it, which for most cities is the same.
 */
const DANISH_NAMES: Record<string, string> = {
  copenhagen: "København",
  elsinore: "Helsingør",
  gothenburg: "Göteborg",
  rome: "Rom",
  munich: "München",
  vienna: "Wien",
  prague: "Prag",
  lisbon: "Lissabon",
  athens: "Athen",
  brussels: "Bruxelles",
  warsaw: "Warszawa",
  cologne: "Köln",
  nuremberg: "Nürnberg",
  zurich: "Zürich",
  geneva: "Genève",
  venice: "Venedig",
  florence: "Firenze",
  milan: "Milano",
  naples: "Napoli",
  turin: "Torino",
  seville: "Sevilla",
  krakow: "Kraków",
  moscow: "Moskva",
  "the hague": "Haag",
  "mexico city": "Mexico City",
};

/** "new york" as "New York", for a city no leg wrote out. */
function titleCase(key: string): string {
  return key.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

/** A city's name in the page's language: as the legs wrote it, or its key title-cased. */
export function cityName(key: string, legs: Leg[], lang: Lang): string {
  return (
    (lang === "da" ? DANISH_NAMES[key] : undefined) ?? cityNames(legs).get(key) ?? titleCase(key)
  );
}

/**
 * Where a trip went: the city it stayed longest in, i.e. where the leg before
 * the longest gap arrived (past the connections on the way).
 */
function destination(legs: Leg[]): string {
  let best = legs[0];
  let gap = -1;
  for (let i = 0; i < legs.length - 1; i++) {
    const between = legs[i + 1].start - legs[i].end;
    if (between > gap) {
      gap = between;
      best = legs[i];
    }
  }
  return best.to;
}

/** Every trip and question as a mark, soonest first. */
export function tripMarks(detected: Detected, lang: Lang): TripMark[] {
  const all = [
    ...detected.trips.flatMap((t) => t.legs),
    ...detected.questions.flatMap((q) => q.legs),
  ];
  const name = (key: string) => cityName(key, all, lang);

  const marks: TripMark[] = detected.trips.map((trip) => ({
    kind: "trip",
    id: trip.id,
    trip,
    start: trip.start,
    end: trip.end,
    city: name(destination(trip.legs)),
  }));
  for (const question of detected.questions) {
    const legs = question.legs;
    const first = legs[0];
    const last = legs[legs.length - 1];
    marks.push({
      kind: "question",
      id: question.id,
      question,
      start: first.start,
      end: last.end,
      // A way back is named by where it comes from; anything else by where it goes.
      city: name(question.kind === "outbound" ? first.from : last.to),
    });
  }
  return marks.sort((a, b) => a.start - b.start);
}

/** The first mark on a day (a local midnight), if any: what a tap on it opens. */
export function markOn(marks: TripMark[], day: number): TripMark | undefined {
  const next = addDays(day, 1, APP_TIME_ZONE);
  return marks.find((m) => m.start < next && m.end > day);
}

/** The day to glide to: where the first mark still waiting for an answer starts. */
export function revealDay(marks: TripMark[]): number | null {
  const first = marks.find(isPending);
  return first ? startOfDay(first.start, APP_TIME_ZONE) : null;
}

/**
 * The marks as bars on the month view, drawn in Casy's own calendar: one
 * waiting for an answer pencilled in and glowing, an accepted trip as an
 * ordinary bar.
 */
export function tripBars(marks: TripMark[], words: Messages["trips"]): GridItem[] {
  return marks.map((m) => {
    const span = { calendarId: CASY_CALENDAR_ID, start: m.start, end: m.end };
    if (!isPending(m)) return { ...span, label: words.barAccepted(m.city) };
    const kind = m.kind === "question" ? m.question.kind : "trip";
    const label =
      kind === "return"
        ? words.barReturn(m.city)
        : kind === "outbound"
          ? words.barOutbound(m.city)
          : words.barPending(m.city);
    return { ...span, label, pencil: true, pulse: true };
  });
}
