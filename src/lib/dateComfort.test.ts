import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import { BIG, MEDIUM, SMALL, comfortRater, sunset, type Penalty } from "@/lib/dateComfort";
import type { EventSettings } from "@/lib/eventSearch";
import { wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

const TZ = "Europe/Copenhagen";
/** Long before every date below, so notice and distance stay out of the way unless asked. */
const NOW = wallTime(2026, 9, 1, 12, TZ);
const EVENING: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };
const TRIP: EventSettings = { kind: "vacation", days: 3 };

const at = (month: number, day: number, hour: number, year = 2026) =>
  new Date(wallTime(year, month, day, hour, TZ)).toISOString();
const slot = (month: number, day: number, from: number, to: number, year = 2026) => ({
  start: at(month, day, from, year),
  end: at(month, day, to, year),
});
const block = (
  month: number,
  day: number,
  from: number,
  to: number,
  more: Partial<BusyInterval> = {},
): BusyInterval => ({ ...slot(month, day, from, to), ...more });
const person = (name: string, busy: BusyInterval[] = []): Participant => ({
  profileId: name,
  name,
  busy,
});
const profile = (more: Partial<EventImpact>): EventImpact => ({
  v: 1,
  effects: [],
  runsLate: false,
  strain: "light",
  recoveryDays: 0,
  outdoors: false,
  daylight: false,
  confidence: "high",
  reason: "",
  ...more,
});

function rate(
  participants: Participant[],
  date: { start: string; end: string },
  {
    settings = EVENING,
    impact,
    now = NOW,
    score,
  }: { settings?: EventSettings; impact?: EventImpact; now?: number; score?: number } = {},
) {
  return comfortRater({ participants, settings, profile: impact, timeZone: TZ, now })(date, score);
}

/** The points one rule gave, all people together. */
const points = (penalties: Penalty[], rule: Penalty["rule"]) =>
  penalties.filter((p) => p.rule === rule).reduce((s, p) => s + p.points, 0);

/** Wednesday 14 October 2026, 18:00 to 21:00. */
const WEDNESDAY = slot(9, 14, 18, 21);

describe("sunset", () => {
  it("is close to the published times in Copenhagen", () => {
    // Midsummer about 21:57 summer time, midwinter about 15:38 winter time.
    const june = sunset(wallTime(2026, 5, 21, 0, TZ), TZ);
    const december = sunset(wallTime(2026, 11, 21, 0, TZ), TZ);
    expect(Math.abs(june - wallTime(2026, 5, 21, 21 + 57 / 60, TZ))).toBeLessThan(5 * 60_000);
    expect(Math.abs(december - wallTime(2026, 11, 21, 15 + 38 / 60, TZ))).toBeLessThan(5 * 60_000);
  });
});

describe("room on the day", () => {
  it("costs nothing with time to spare either side", () => {
    const busy = [block(9, 14, 9, 17, { category: "work" }), block(9, 14, 22, 23)];
    expect(rate([person("a", busy)], WEDNESDAY).penalties).toEqual([]);
  });

  it("costs more the less room there is before, and wants more after work", () => {
    const tight = rate([person("a", [block(9, 14, 12, 17.5)])], WEDNESDAY);
    expect(points(tight.penalties, "tightBefore")).toBeCloseTo(MEDIUM * (1 - 30 / 30));
    const half = rate([person("a", [block(9, 14, 12, 17.75)])], WEDNESDAY);
    expect(points(half.penalties, "tightBefore")).toBeCloseTo(MEDIUM * 0.5);
    const work = rate([person("a", [block(9, 14, 12, 17.5, { category: "work" })])], WEDNESDAY);
    expect(points(work.penalties, "tightBefore")).toBeCloseTo(MEDIUM * (1 - 30 / 45));
  });

  it("weighs a block right after lighter than one right before", () => {
    const after = rate([person("a", [block(9, 14, 21, 23)])], WEDNESDAY);
    expect(points(after.penalties, "tightAfter")).toBeCloseTo(MEDIUM * 0.6);
  });

  it("costs extra when squeezed between two blocks", () => {
    const busy = [block(9, 14, 15, 18), block(9, 14, 21, 23)];
    const squeezed = rate([person("a", busy)], WEDNESDAY);
    expect(points(squeezed.penalties, "sandwiched")).toBeCloseTo(MEDIUM);
  });

  it("lets a skip calendar give way, counts a never one half again, and leaves holidays out", () => {
    const skip = rate([person("a", [block(9, 14, 15, 18, { priority: "skip" })])], WEDNESDAY);
    expect(skip.penalties).toEqual([]);
    const never = rate([person("a", [block(9, 14, 15, 18, { priority: "never" })])], WEDNESDAY);
    expect(points(never.penalties, "tightBefore")).toBeCloseTo(MEDIUM * 1.5);
    const holiday = rate([person("a", [block(9, 14, 15, 18, { holiday: true })])], WEDNESDAY);
    expect(holiday.penalties).toEqual([]);
  });
});

describe("the morning after", () => {
  const late = slot(9, 14, 20, 22.5);
  const work = block(9, 15, 8, 16, { category: "work" });

  it("costs a lot to end late before work early the next morning", () => {
    expect(points(rate([person("a", [work])], late).penalties, "earlyAfterLate")).toBe(BIG);
  });

  it("costs half again when the event is a late or boozy one", () => {
    const party = rate([person("a", [work])], late, { impact: profile({ effects: ["alcohol"] }) });
    expect(points(party.penalties, "earlyAfterLate")).toBe(BIG * 1.5);
  });

  it("counts a never block, not personal plans, nor a morning that starts late", () => {
    const never = block(9, 15, 8, 9, { priority: "never" });
    expect(points(rate([person("a", [never])], late).penalties, "earlyAfterLate")).toBe(BIG);
    const gym = block(9, 15, 7, 8);
    expect(points(rate([person("a", [gym])], late).penalties, "earlyAfterLate")).toBe(0);
    const ten = block(9, 15, 10, 16, { category: "work" });
    expect(points(rate([person("a", [ten])], late).penalties, "earlyAfterLate")).toBe(0);
  });

  it("leaves an evening ending before 22:00 alone", () => {
    expect(points(rate([person("a", [work])], WEDNESDAY).penalties, "earlyAfterLate")).toBe(0);
  });
});

describe("the date itself", () => {
  it("puts a party on a weekend rather than a school night", () => {
    const party = { impact: profile({ effects: ["alcohol"] }) };
    expect(points(rate([], WEDNESDAY, party).penalties, "schoolNight")).toBe(MEDIUM);
    const friday = slot(9, 16, 18, 21);
    expect(points(rate([], friday, party).penalties, "schoolNight")).toBe(-2 * SMALL);
    expect(points(rate([], WEDNESDAY).penalties, "schoolNight")).toBe(0);
  });

  it("costs a lot to end after dark when it needs daylight", () => {
    const outside = { impact: profile({ daylight: true }) };
    const winter = slot(11, 2, 13, 17);
    expect(points(rate([], winter, outside).penalties, "afterDark")).toBe(BIG);
    const summer = slot(5, 10, 13, 17, 2027);
    expect(points(rate([], summer, outside).penalties, "afterDark")).toBe(0);
  });

  it("knows the days people keep for family", () => {
    const of = (date: { start: string; end: string }) =>
      points(rate([], date).penalties, "dayOfYear");
    expect(of(slot(11, 31, 12, 15))).toBe(BIG);
    expect(of(slot(11, 28, 12, 15))).toBe(MEDIUM);
    expect(of(slot(0, 1, 14, 17, 2027))).toBe(MEDIUM);
    // 2027: Easter Monday 29 March, Ascension 6 May, Mother's Day 9 May.
    expect(of(slot(2, 29, 12, 15, 2027))).toBe(MEDIUM);
    expect(of(slot(4, 7, 12, 15, 2027))).toBe(MEDIUM);
    expect(of(slot(4, 9, 12, 15, 2027))).toBe(MEDIUM);
    expect(of(slot(5, 5, 12, 15, 2027))).toBe(MEDIUM);
    expect(of(slot(5, 23, 19, 22, 2027))).toBe(MEDIUM);
    expect(of(slot(5, 23, 10, 12, 2027))).toBe(0);
    expect(of(WEDNESDAY)).toBe(0);
  });

  it("makes a trip over a long weekend a bonus", () => {
    const ascension = { start: at(4, 6, 0, 2027), end: at(4, 9, 0, 2027) };
    expect(points(rate([], ascension, { settings: TRIP }).penalties, "dayOfYear")).toBe(-MEDIUM);
    const plain = { start: at(4, 17, 0, 2027), end: at(4, 20, 0, 2027) };
    expect(points(rate([], plain, { settings: TRIP }).penalties, "dayOfYear")).toBe(0);
  });

  it("wants notice: a day for a meeting, a week or two for a trip", () => {
    const now = wallTime(2026, 9, 14, 8, TZ);
    expect(points(rate([], WEDNESDAY, { now }).penalties, "notice")).toBe(BIG);
    const thursday = slot(9, 15, 18, 21);
    expect(points(rate([], thursday, { now }).penalties, "notice")).toBe(MEDIUM);
    expect(points(rate([], slot(9, 17, 18, 21), { now }).penalties, "notice")).toBe(0);
    const trip = { start: at(9, 20, 0), end: at(9, 23, 0) };
    expect(points(rate([], trip, { now, settings: TRIP }).penalties, "notice")).toBe(BIG);
    // A date already past (a test, or the clock) is no matter of notice.
    expect(
      points(rate([], WEDNESDAY, { now: wallTime(2026, 9, 20, 0, TZ) }).penalties, "notice"),
    ).toBe(0);
  });

  it("costs a little for each week far ahead", () => {
    const now = wallTime(2026, 8, 2, 18, TZ);
    // Six weeks ahead: four past the free two.
    expect(points(rate([], WEDNESDAY, { now }).penalties, "farAhead")).toBeCloseTo(2, 1);
    // Exactly five weeks: three past the free two.
    expect(points(rate([], slot(9, 7, 18, 21), { now }).penalties, "farAhead")).toBeCloseTo(1.5);
  });
});

describe("the cost of a date", () => {
  it("adds everyone up and counts the worst person once more", () => {
    const tight = person("a", [block(9, 14, 12, 18)]);
    const { cost } = rate([tight, person("b"), person("c")], WEDNESDAY);
    // a's MEDIUM, b and c nothing, and a again as the worst.
    expect(cost).toBeCloseTo(MEDIUM * 2);
  });

  it("counts the date's own penalties for everyone", () => {
    const now = wallTime(2026, 11, 20, 12, TZ);
    const { cost } = rate([person("a"), person("b")], slot(11, 28, 12, 15), { now });
    expect(cost).toBeCloseTo(MEDIUM * 3);
  });

  it("takes the server's score in the same unit: a missing fifth of two people is 4", () => {
    const { cost } = rate([person("a"), person("b")], WEDNESDAY, { score: 80 });
    expect(cost).toBeCloseTo(0.2 * 2 * BIG);
  });

  it("rates only the people the search is for", () => {
    const tight = person("a", [block(9, 14, 12, 18)]);
    const settings: EventSettings = {
      ...EVENING,
      people: { members: ["a", "b"], optional: ["a"] },
    };
    expect(rate([tight, person("b")], WEDNESDAY, { settings }).cost).toBe(0);
  });
});
