/** trips.ts, tripView.ts and tripLegBook.ts's legs, for TripDetection.swift (#202: trips found natively). */
import type { TripLeg } from "@/api/tripLegs";
import type { Messages } from "@/i18n/da";
import { TRIP_NOTES } from "@/lib/casyTripEntry";
import { labelKey, type LabelBook } from "@/lib/eventLabels";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import { casyTripSpans, legKey, phoneLegs, type LegBook } from "@/lib/tripLegBook";
import { cityKey, detectTrips, homeOf, type Leg, type TripAnswers } from "@/lib/trips";
import { markOn, revealDay, tripBars, tripMarks, withoutTripsInCalendar } from "@/lib/tripView";
import { APP_TIME_ZONE, wallTime } from "@/lib/zone";

import { caseBook, type ParityCase } from "./cases";

const HOUR = 3_600_000;
const CITIES = ["copenhagen", "rome", "oslo", "berlin", "aarhus"];
const NAMES: Record<string, string> = {
  copenhagen: "Copenhagen",
  rome: "Rome",
  oslo: "Oslo",
  berlin: "Berlin",
  aarhus: "Aarhus",
};
const WORDS = {
  barPending: (c: string) => `P:${c}`,
  barAccepted: (c: string) => `A:${c}`,
  barReturn: (c: string) => `R:${c}`,
  barOutbound: (c: string) => `O:${c}`,
} as unknown as Messages["trips"];

export function tripsCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261126);
  const flag = (odds: number) => random() < odds;
  const at = (day: number, hour: number) => wallTime(2026, 9, day, hour, APP_TIME_ZONE);

  for (const name of [
    "København",
    " Kobenhavn ",
    "MÜNCHEN",
    "New  York",
    "Århus",
    "Ærø",
    "Zürich",
    "oslo",
  ])
    add("cityKey", { name }, cityKey(name));

  for (let i = 0; i < 120; i++) {
    const home = pick(CITIES.slice(0, 2));
    const legs: Leg[] = [];
    let day = int(1, 6);
    for (let n = int(0, 7); n > 0; n--) {
      const from = flag(0.6) ? home : pick(CITIES);
      const to = flag(0.5) && from !== home ? home : pick(CITIES);
      const start = at(day, int(6, 20));
      legs.push({
        id: `leg-${legs.length}`,
        mode: pick(["flight", "train", "bus"] as const),
        from,
        to,
        start,
        end: start + int(1, flag(0.05) ? 40 : 9) * HOUR,
        count: flag(0.1) ? 5 : 1,
        names: flag(0.8) ? { from: NAMES[from], to: NAMES[to] } : undefined,
      });
      day += int(0, flag(0.1) ? 70 : 6);
    }
    const ids = legs.map((l) => l.id);
    const some = (odds: number) => ids.filter(() => flag(odds));
    const keptIds = some(0.15).sort();
    const answers: TripAnswers = {
      home: flag(0.3) ? home : undefined,
      returns: Object.fromEntries(some(0.15).map((id) => [id, at(int(5, 40), 0)])),
      outbounds: Object.fromEntries(some(0.15).map((id) => [id, at(int(1, 30), 0)])),
      accepted: some(0.3),
      dismissed: some(0.1),
      kept: Object.fromEntries(
        [...keptIds, ...(flag(0.2) ? ["gone-trip"] : [])].map((id) => {
          const start = at(int(1, 40), int(0, 23));
          return [
            id,
            {
              start,
              end: start + int(24, 200) * HOUR,
              city: pick(["Rom", "Oslo"]),
              eventId: flag(0.5) ? pick(["EV-1", ""]) : undefined,
            },
          ];
        }),
      ),
    };
    const now = at(int(1, 40), 12);
    const inCalendar = flag(0.2)
      ? [{ start: at(int(1, 30), 9), end: at(int(1, 30), 9) + 72 * HOUR }]
      : [];
    add("homeOf", { legs, answers }, homeOf(legs, answers));
    const detected = detectTrips(legs, answers, now, inCalendar);
    add("detectTrips", { legs, answers, now, inCalendar }, detected);
    const lang = pick(["da", "en"] as const);
    const marks = tripMarks(detected, lang);
    add("tripMarks", { detected, lang }, marks);
    const step = int(0, 7);
    add("tripBars", { marks, step }, tripBars(marks, WORDS, step));
    const items = marks
      .filter(() => flag(0.4))
      .map((m) => ({
        calendarId: pick(["CAL-1", "builtin:casy-entries"]),
        start: m.start,
        end: m.end,
      }));
    add("withoutTripsInCalendar", { marks, items }, withoutTripsInCalendar(marks, items));
    const tapped = at(int(1, 40), 0);
    add("markOn", { marks, day: tapped }, markOn(marks, tapped)?.id ?? null);
    add("revealDay", { marks }, revealDay(marks));
  }

  // The phone's events as legs.
  const TITLES = ["Fly til Oslo", "Tog hjem", "Bus til Aarhus", "Fly SK123", "Eksamen"];
  for (let i = 0; i < 50; i++) {
    const calendars = ["CAL-0", "CAL-1"];
    const names = Object.fromEntries(calendars.filter(() => flag(0.85)).map((c) => [c, c]));
    const events: PhoneEventWithDetails[] = Array.from({ length: int(0, 14) }, () => {
      const start = at(int(1, 40), int(5, 20));
      return {
        calendarId: pick(calendars),
        free: flag(0.1),
        cancelled: flag(0.05),
        declined: false,
        allDay: false,
        start,
        end: start + int(1, 6) * HOUR,
        title: pick(TITLES),
        location: flag(0.4) ? "CPH" : undefined,
        notes: flag(0.15) ? pick([...TRIP_NOTES, "Husk pas"]) : undefined,
      };
    });
    const labels: LabelBook = {};
    const book: LegBook = {};
    for (const e of events) {
      const title = e.title!;
      if (flag(0.85))
        labels[labelKey(e.calendarId, title)] = {
          kind: pick(["flight", "travel", "exam"]) as "flight",
          importance: "normal",
          prepDays: 0,
          avoidBefore: [],
          recoveryDays: 0,
          strain: "light",
          confidence: "medium",
          reason: "",
          count: 1,
        };
      const key = legKey(e.calendarId, title, e.location ?? "");
      if (!book[key] && flag(0.8)) {
        const leg: TripLeg = {
          mode: pick(["flight", "train", "bus", "none"]),
          from: pick(["Copenhagen", "HOME", "", "København"]),
          to: pick(["Oslo", "Aarhus", "", "HOME"]),
          confidence: pick(["low", "medium", "high"]),
        };
        book[key] = leg;
      }
    }
    const first = events[0] ? casyTripSpans(events)[0] : undefined;
    const answers: TripAnswers = {
      home: flag(0.3) ? "copenhagen" : undefined,
      returns: {},
      outbounds: {},
      accepted: [],
      dismissed: [],
      kept: first && flag(0.5) ? { k: { start: first.start, end: first.end, city: "Oslo" } } : {},
    };
    const legs = phoneLegs(events, labels, book, new Map(Object.entries(names)), answers);
    add("phoneLegs", { events, labels, book, names, answers }, legs);
    add("casyTripSpans", { events }, casyTripSpans(events));
  }
  return cases;
}
