/** tripLegBook.ts's leg reading, for TripLegBook.swift (#282: trips read natively). */
import type { TripLeg } from "@/api/tripLegs";
import { labelKey, type LabelBook } from "@/lib/eventLabels";
import { TRIP_NOTES } from "@/lib/casyTripEntry";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import {
  legBatches,
  legKey,
  presentLegKeys,
  tidyLegBook,
  travelCandidates,
  type LegBook,
} from "@/lib/tripLegBook";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TITLES = [
  "Fly til Oslo",
  "Tog hjem",
  "Bus til Aarhus",
  "Eksamen",
  "Fly SK123",
  " fly til  oslo ",
];
const PLACES = ["", "CPH Lufthavn", "Aarhus H", " cph lufthavn "];

export function tripLegBookCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261125);
  const flag = (odds: number) => random() < odds;

  for (const [c, t, l] of [
    ["CAL-1", "Fly til Oslo", ""],
    ["CAL-1", " fly  til oslo", "CPH"],
    ["CAL-2", "Tog", "Aarhus H"],
  ])
    add("legKey", { calendarId: c, title: t, location: l }, legKey(c, t, l));

  for (let i = 0; i < 50; i++) {
    const calendars = ["CAL-0", "CAL-1"];
    const names = new Map(calendars.filter(() => flag(0.85)).map((c, n) => [c, `Navn ${n}`]));
    const events: PhoneEventWithDetails[] = Array.from({ length: int(0, 20) }, () => {
      const start = NOW + int(-14 * 24, 60 * 24) * HOUR;
      return {
        calendarId: pick(calendars),
        free: flag(0.1),
        cancelled: flag(0.05),
        declined: false,
        allDay: false,
        start,
        end: start + int(1, 6) * HOUR,
        title: flag(0.95) ? pick(TITLES) : undefined,
        location: flag(0.6) ? pick(PLACES) : undefined,
        notes: flag(0.15) ? pick([...TRIP_NOTES, "Husk pas"]) : undefined,
      };
    });
    const labels: LabelBook = {};
    for (const e of events) {
      if (!e.title?.trim() || !flag(0.8)) continue;
      labels[labelKey(e.calendarId, e.title.trim())] = {
        kind: pick(["flight", "travel", "exam", "flight"]) as "flight",
        importance: "normal",
        prepDays: 0,
        avoidBefore: [],
        recoveryDays: 0,
        strain: "light",
        confidence: "medium",
        reason: "",
        count: 1,
      };
    }
    const candidates = travelCandidates(events, labels, names, NOW);
    add(
      "travelCandidates",
      { events, labels, names: Object.fromEntries(names), now: NOW },
      candidates,
    );
    const leg = (): TripLeg => ({
      mode: pick(["flight", "train", "bus", "none"]),
      from: pick(["Copenhagen", "HOME", ""]),
      to: pick(["Oslo", "Aarhus", ""]),
      confidence: pick(["low", "medium", "high"]),
    });
    const book: LegBook = {};
    for (const c of candidates) if (flag(0.4)) book[c.key] = leg();
    if (flag(0.5)) book["gone-leg"] = leg();
    const asked = candidates.filter(() => flag(0.2)).map((c) => c.key);
    add("legBatches", { candidates, book, asked }, legBatches(candidates, book, new Set(asked)));
    const present = presentLegKeys(events, labels);
    add("presentLegKeys", { events, labels }, [...present].sort());
    const tidy = tidyLegBook(book, present);
    add("tidyLegBook", { book, present: [...present] }, tidy === book ? "same" : tidy);
  }
  return cases;
}
