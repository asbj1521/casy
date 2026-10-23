import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TripLeg } from "@/api/tripLegs";
import {
  clearLabelBooks,
  clearLabelsFor,
  labelKey,
  type LabelBook,
  type StoredLabel,
} from "@/lib/eventLabels";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import {
  BATCH_SIZE,
  legBatches,
  legKey,
  phoneLegs,
  presentLegKeys,
  readLegBook,
  readTripAnswers,
  tidyLegBook,
  travelCandidates,
  writeLegBook,
  writeTripAnswers,
  type LegBook,
} from "@/lib/tripLegBook";
import { NO_ANSWERS } from "@/lib/trips";

const NOW = Date.parse("2026-10-01T08:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const event = (
  title: string,
  start: number,
  over: Partial<PhoneEventWithDetails> = {},
): PhoneEventWithDetails => ({
  calendarId: "ek-home",
  allDay: false,
  free: false,
  cancelled: false,
  declined: false,
  start,
  end: start + 2 * HOUR,
  title,
  location: "",
  ...over,
});

const names = new Map([["ek-home", "Kalender"]]);

const label = (kind: StoredLabel["kind"]): StoredLabel => ({
  kind,
  importance: "high",
  prepDays: 1,
  avoidBefore: [],
  recoveryDays: 0,
  strain: "moderate",
  confidence: "high",
  reason: "",
  count: 1,
});

const labelsFor = (...entries: [string, StoredLabel["kind"]][]): LabelBook =>
  Object.fromEntries(entries.map(([title, kind]) => [labelKey("ek-home", title), label(kind)]));

const leg = (from: string, to: string, over: Partial<TripLeg> = {}): TripLeg => ({
  mode: "flight",
  from,
  to,
  confidence: "high",
  ...over,
});

describe("travelCandidates", () => {
  it("takes only what the labels call a flight or travel, once per title and place", () => {
    const events = [
      event("Fly til Oslo", NOW + 2 * DAY, { location: "CPH" }),
      event("Fly til Oslo", NOW + 9 * DAY, { location: "CPH" }),
      event("Fly til Oslo", NOW + 16 * DAY, { location: "Billund" }),
      event("Tog", NOW + 3 * DAY),
      event("Eksamen", NOW + 4 * DAY),
      event("Hotel", NOW + 5 * DAY),
    ];
    const labels = labelsFor(
      ["Fly til Oslo", "flight"],
      ["Tog", "travel"],
      ["Eksamen", "exam"],
      ["Hotel", "stay"],
    );
    const candidates = travelCandidates(events, labels, names, NOW);
    expect(candidates.map((c) => [c.event.title, c.event.location])).toEqual([
      ["Fly til Oslo", "CPH"],
      ["Tog", ""],
      ["Fly til Oslo", "Billund"],
    ]);
    expect(candidates[0].event).toEqual({
      title: "Fly til Oslo",
      location: "CPH",
      calendar: "Kalender",
      allDay: false,
    });
  });

  it("leaves out calendars that don't count and events long past", () => {
    const events = [
      event("Fly", NOW + DAY, { calendarId: "ek-other" }),
      event("Fly", NOW - 10 * DAY),
    ];
    expect(travelCandidates(events, labelsFor(["Fly", "flight"]), names, NOW)).toEqual([]);
  });
});

describe("legBatches and tidyLegBook", () => {
  const candidates = Array.from({ length: BATCH_SIZE + 3 }, (_, i) => ({
    key: `k${i}`,
    next: NOW + i,
    event: { title: `t${i}`, location: "", calendar: "Kalender", allDay: false },
  }));

  it("asks only about what isn't read or asked yet, in batches", () => {
    const batches = legBatches(candidates, { k0: leg("A", "B") }, new Set(["k1"]));
    expect(batches.map((b) => b.length)).toEqual([BATCH_SIZE, 1]);
    expect(batches[0][0].key).toBe("k2");
  });

  it("drops legs whose event is gone, and keeps the same book otherwise", () => {
    const present = new Set(["k0"]);
    const book: LegBook = { k0: leg("A", "B"), gone: leg("C", "D") };
    expect(Object.keys(tidyLegBook(book, present))).toEqual(["k0"]);
    const kept = { k0: leg("A", "B") };
    expect(tidyLegBook(kept, present)).toBe(kept);
  });
});

describe("presentLegKeys", () => {
  it("counts the phone's travel events whatever calendars the server lists (#132)", () => {
    // With the phone's connection removed the server lists no calendars for it,
    // so no candidates: the legs must still be kept, as their events are there.
    const flight = event("Fly til Oslo", NOW + 2 * DAY, { calendarId: "ek-not-listed" });
    const labels = {
      [labelKey("ek-not-listed", "Fly til Oslo")]: label("flight"),
    };
    expect(travelCandidates([flight], labels, names, NOW)).toEqual([]);
    expect(presentLegKeys([flight], labels)).toEqual(
      new Set([legKey("ek-not-listed", "Fly til Oslo", "")]),
    );
  });
});

describe("phoneLegs", () => {
  const labels = labelsFor(
    ["Fly til Oslo", "flight"],
    ["Fly hjem", "flight"],
    ["SK1467", "flight"],
    ["Kør hjem", "travel"],
  );
  const out = event("Fly til Oslo", NOW + 2 * DAY);
  const back = event("Fly hjem", NOW + 6 * DAY);
  const book = (entries: [PhoneEventWithDetails, TripLeg][]): LegBook =>
    Object.fromEntries(
      entries.map(([e, l]) => [legKey(e.calendarId, e.title!, e.location ?? ""), l]),
    );

  it("gives every occurrence of a read leg, with city keys and its own id", () => {
    const legs = phoneLegs(
      [out, back],
      labels,
      book([
        [out, leg("Copenhagen", "Oslo")],
        [back, leg("Oslo", "København")],
      ]),
      names,
      NO_ANSWERS,
    );
    expect(legs.map((l) => [l.from, l.to])).toEqual([
      ["copenhagen", "oslo"],
      ["oslo", "kobenhavn"],
    ]);
    expect(legs[0].id).toBe(`${legKey("ek-home", "Fly til Oslo", "")}@${out.start}`);
    expect(legs[0].count).toBe(1);
  });

  it("fills in home where the title only says home, once home is known", () => {
    const legs = phoneLegs(
      [out, back],
      labels,
      book([
        [out, leg("", "Oslo")],
        [back, leg("Oslo", "HOME")],
      ]),
      names,
      { ...NO_ANSWERS, home: "copenhagen" },
    );
    expect(legs.map((l) => [l.from, l.to])).toEqual([
      ["copenhagen", "oslo"],
      ["oslo", "copenhagen"],
    ]);
  });

  it("leaves out what can't be placed while home isn't known", () => {
    const legs = phoneLegs(
      [out, back],
      labels,
      book([
        [out, leg("", "Oslo")],
        [back, leg("Oslo", "HOME")],
      ]),
      names,
      NO_ANSWERS,
    );
    expect(legs).toEqual([]);
  });

  it("leaves out journeys that aren't by plane, train or bus, unsure ones and ones naming no city", () => {
    const flight = event("SK1467", NOW + 3 * DAY);
    const drive = event("Kør hjem", NOW + 4 * DAY);
    const legs = phoneLegs(
      [out, flight, drive],
      labels,
      book([
        [out, leg("Copenhagen", "Oslo", { confidence: "low" })],
        [flight, leg("", "")],
        [drive, leg("", "", { mode: "none" })],
      ]),
      names,
      { ...NO_ANSWERS, home: "copenhagen" },
    );
    expect(legs).toEqual([]);
  });
});

/** A plain in-memory stand-in for the browser's localStorage. */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, String(v)),
    removeItem: (k) => void items.delete(k),
    clear: () => items.clear(),
  };
}

describe("kept on the phone", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  const answers = { ...NO_ANSWERS, home: "copenhagen", accepted: ["t1"] };

  it("reads back what was written, per person", () => {
    writeLegBook("a", { k: leg("A", "B") });
    writeTripAnswers("a", answers);
    expect(readLegBook("a")).toEqual({ k: leg("A", "B") });
    expect(readTripAnswers("a")).toEqual(answers);
    expect(readLegBook("b")).toEqual({});
    expect(readTripAnswers("b")).toEqual(NO_ANSWERS);
  });

  it("goes with the AI's consent, and with signing out", () => {
    writeLegBook("a", { k: leg("A", "B") });
    writeTripAnswers("a", answers);
    writeLegBook("b", { k: leg("A", "B") });
    clearLabelsFor("a");
    expect(readLegBook("a")).toEqual({});
    expect(readTripAnswers("a")).toEqual(NO_ANSWERS);
    expect(readLegBook("b")).not.toEqual({});
    clearLabelBooks();
    expect(readLegBook("b")).toEqual({});
  });
});
