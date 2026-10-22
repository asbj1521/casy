import { describe, expect, it } from "vitest";

import type { EventSettings } from "@/lib/eventSearch";
import {
  buildPile,
  candidateMonth,
  checkTimes,
  jostle,
  layerAlpha,
  liveOrder,
  PILE_OPACITY,
  PILE_TIMING,
  pileTimeline,
  rankOrder,
  sheetTilt,
  throwSide,
  type PileOptions,
  type RankedFacts,
} from "@/lib/paperPile";
import { wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

const TZ = "Europe/Copenhagen";
const iso = (y: number, m: number, d: number, h = 0) =>
  new Date(wallTime(y, m, d, h, TZ)).toISOString();
const EVENING: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };

/** Busy 17:00-23:00 on each day of October 2026 given. */
const evenings = (...days: number[]): BusyInterval[] =>
  days.map((d) => ({ start: iso(2026, 9, d, 17), end: iso(2026, 9, d, 23) }));
const person = (id: string, busy: BusyInterval[] = []): Participant => ({
  profileId: id,
  name: id.toUpperCase(),
  busy,
});

/** Searching October and November 2026, from 1 October. */
const OPTS: PileOptions = {
  timeZone: TZ,
  todayMs: Date.parse(iso(2026, 9, 1)),
  windowEndMs: Date.parse(iso(2026, 11, 1)),
  window: { start: iso(2026, 9, 1), end: iso(2026, 11, 1) },
};

describe("buildPile", () => {
  it("gives everyone a sheet, yours first, with their own free and busy days", () => {
    const group = [
      person("ann", evenings(5)),
      person("me", evenings(7)),
      person("bo", evenings(9)),
    ];
    const pile = buildPile(group, EVENING, "me", 2026, 9, OPTS);

    expect(pile.sheets.map((s) => s.profileId)).toEqual(["me", "ann", "bo"]);
    expect(pile.sheets[0].isYou).toBe(true);
    expect(pile.sheets[0].days).toHaveLength(31);
    expect(pile.sheets[0].days[6]).toBe("busy"); // the 7th
    expect(pile.sheets[0].days[4]).toBe("free"); // ann's busy day is free on mine
    expect(pile.sheets[1].days[4]).toBe("busy");
    expect(pile.label).toBe("Oktober 2026");
  });

  it("lets through only the days free on every sheet", () => {
    const group = [person("me", evenings(7)), person("ann", evenings(5, 6))];
    const { through } = buildPile(group, EVENING, "me", 2026, 9, OPTS);

    expect(through[3]).toBe(true); // the 4th: nobody busy
    expect([through[4], through[5], through[6]]).toEqual([false, false, false]);
  });

  it("starts the week on Monday: 1 October 2026 is a Thursday", () => {
    expect(buildPile([person("me")], EVENING, "me", 2026, 9, OPTS).lead).toBe(3);
  });

  it("gives optional members no sheet: they never block a date", () => {
    const group = [person("me"), person("ann", evenings(5))];
    const search: EventSettings = {
      ...EVENING,
      people: { members: ["me", "ann"], optional: ["ann"] },
    };
    const pile = buildPile(group, search, "me", 2026, 9, OPTS);

    expect(pile.sheets.map((s) => s.profileId)).toEqual(["me"]);
    expect(pile.through[4]).toBe(true);
  });

  it("marks days before the period, or on weekdays not searched, off on every sheet", () => {
    const opts = { ...OPTS, window: { start: iso(2026, 9, 10), end: OPTS.window.end } };
    const weekends: EventSettings = { ...EVENING, allowedDays: [0, 6] };
    const pile = buildPile([person("me")], weekends, "me", 2026, 9, opts);

    expect(pile.sheets[0].days[2]).toBe("off"); // Sat 3rd, before the period
    expect(pile.sheets[0].days[10]).toBe("free"); // Sun 11th
    expect(pile.sheets[0].days[11]).toBe("off"); // Mon 12th, not searched
    expect(pile.through[2]).toBe(false);
    expect(pile.through[10]).toBe(true);
  });

  it("shows a day free only by skipping something as soft", () => {
    const skippable = [{ ...evenings(5)[0], priority: "skip" as const }];
    const pile = buildPile([person("me", skippable)], EVENING, "me", 2026, 9, OPTS);

    expect(pile.sheets[0].days[4]).toBe("soft");
    expect(pile.through[4]).toBe(false);
  });
});

describe("candidateMonth", () => {
  const FALLBACK = iso(2026, 9, 1);

  it("picks the month most of the dates offered are in", () => {
    const starts = [iso(2026, 9, 30, 19), iso(2026, 10, 3, 19), iso(2026, 10, 5, 19)];
    expect(candidateMonth(starts, FALLBACK, TZ)).toEqual({ year: 2026, month: 10 });
  });

  it("takes the earlier month on a tie, in whatever order the dates come", () => {
    const starts = [iso(2026, 10, 3, 19), iso(2026, 9, 30, 19)];
    expect(candidateMonth(starts, FALLBACK, TZ)).toEqual({ year: 2026, month: 9 });
  });

  it("counts a date by its Danish day: Danish midnight on 1 November is November", () => {
    // 23:00 on 31 October in UTC.
    const starts = [iso(2026, 10, 1, 0), iso(2026, 10, 2, 19)];
    expect(candidateMonth(starts, FALLBACK, TZ)).toEqual({ year: 2026, month: 10 });
  });

  it("falls back to the period's first month with no dates", () => {
    expect(candidateMonth([], iso(2027, 1, 10), TZ)).toEqual({ year: 2027, month: 1 });
  });
});

describe("pileTimeline", () => {
  it("throws each calendar faster than the one before, never faster than the floor", () => {
    const { lands } = pileTimeline(12);
    const durations = lands.map((l) => l.duration);
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeLessThanOrEqual(durations[i - 1]);
    }
    expect(Math.min(...durations)).toBe(PILE_TIMING.fastestLand);
  });

  it("presses only once the last calendar has hit and settled", () => {
    const t = pileTimeline(3);
    const last = t.lands[2];
    expect(t.pressAt).toBeCloseTo(
      last.at + last.duration + PILE_TIMING.impact + PILE_TIMING.settle,
    );
    expect(t.revealAt).toBeGreaterThan(t.pressAt);
    expect(t.rankAt).toBeGreaterThan(t.liftAt);
  });

  it("checks the dates quicker and quicker, then lets the last settle", () => {
    const times = checkTimes(8);
    const gaps = times.map((at, i) => at - (times[i - 1] ?? 0));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1]);
    expect(Math.min(...gaps)).toBeCloseTo(PILE_TIMING.checkFastest);
    const t = pileTimeline(3, 8);
    expect(t.doneAt).toBeCloseTo(t.rankAt + times[7] + PILE_TIMING.ranked);
  });

  it("leaves a beat between one throw landing and the next", () => {
    const { lands } = pileTimeline(3);
    expect(lands[1].at).toBeCloseTo(lands[0].at + lands[0].duration + PILE_TIMING.gap);
  });

  it("takes about 7 to 14 seconds with a list to check, from a group of two to the largest", () => {
    for (const others of [1, 3, 8, 19]) {
      const { doneAt } = pileTimeline(others, 6);
      expect(doneAt).toBeGreaterThanOrEqual(7);
      expect(doneAt).toBeLessThanOrEqual(14);
    }
  });
});

describe("throwSide and jostle", () => {
  it("throws from the left first, then the right, and so on", () => {
    expect([0, 1, 2, 3].map(throwSide)).toEqual([-1, 1, -1, 1]);
  });

  it("leaves a calendar still until one lands on it, then shoves it away from the thrower", () => {
    expect(jostle(0, 1)).toEqual({ x: 0, rotate: 0 });
    // The second calendar comes from the right: the first is pushed left.
    expect(jostle(0, 2).x).toBeLessThan(0);
    // The third, from the left, pushes back, but less than the one right on top.
    expect(jostle(0, 3).x).toBeGreaterThan(jostle(0, 2).x);
  });
});

describe("sheetTilt", () => {
  it("lays yours straight and every other sheet crooked, alternating sides", () => {
    expect(sheetTilt(0)).toEqual({ rotate: 0, x: 0, y: 0 });
    for (let i = 1; i < 20; i++) {
      const { rotate } = sheetTilt(i);
      expect(Math.abs(rotate)).toBeGreaterThanOrEqual(2);
      expect(Math.abs(rotate)).toBeLessThanOrEqual(7);
      expect(Math.sign(rotate)).toBe(i % 2 === 0 ? 1 : -1);
    }
  });

  it("is the same every time", () => {
    expect(sheetTilt(5)).toEqual(sheetTilt(5));
  });
});

describe("layerAlpha", () => {
  it("makes any number of layers together just as opaque", () => {
    for (const n of [1, 2, 5, 19]) {
      const through = (1 - layerAlpha(n)) ** n;
      expect(1 - through).toBeCloseTo(PILE_OPACITY);
    }
  });

  it("makes each layer lighter the more layers there are", () => {
    expect(layerAlpha(2)).toBeLessThan(layerAlpha(1));
    expect(layerAlpha(10)).toBeLessThan(layerAlpha(2));
    expect(layerAlpha(0)).toBe(0);
  });
});

describe("rankOrder", () => {
  const date = (over: Partial<RankedFacts>): RankedFacts => ({
    pickedAt: null,
    conflicts: 0,
    warnings: 0,
    start: 0,
    ...over,
  });

  it("puts the dates a vote offers first, in the order they were chosen", () => {
    const dates = [
      date({ pickedAt: 2, start: 1 }),
      date({ start: 2 }),
      date({ pickedAt: 0, start: 3 }),
      date({ pickedAt: 1, start: 4 }),
    ];
    expect(rankOrder(dates)).toEqual([2, 3, 0, 1]);
  });

  it("ranks the rest by fewest giving something up, then fewest notes, then soonest", () => {
    const dates = [
      date({ conflicts: 1, start: 1 }),
      date({ warnings: 1, start: 2 }),
      date({ start: 4 }),
      date({ start: 3 }),
    ];
    expect(rankOrder(dates)).toEqual([3, 2, 1, 0]);
  });
});

describe("liveOrder", () => {
  // Five dates; best first they are 3, 0, 4, 1, 2; 3, 0 and 4 are offered.
  const ranked = [3, 0, 4, 1, 2];
  const offered = [true, false, false, true, true];

  it("is the dates' own order before any is checked", () => {
    expect(liveOrder(ranked, 0, offered)).toEqual([0, 1, 2, 3, 4]);
  });

  it("lifts a checked good date to the top and sinks a checked other to the bottom", () => {
    expect(liveOrder(ranked, 1, offered)).toEqual([0, 1, 2, 3, 4]);
    expect(liveOrder(ranked, 2, offered)).toEqual([0, 2, 3, 4, 1]);
    expect(liveOrder(ranked, 4, offered)).toEqual([3, 0, 4, 1, 2]);
  });

  it("ends as the ranking itself", () => {
    expect(liveOrder(ranked, 5, offered)).toEqual(ranked);
  });
});
