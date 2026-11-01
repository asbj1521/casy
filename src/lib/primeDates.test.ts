import { describe, expect, it } from "vitest";

import {
  freeGaps,
  LOOK_AHEAD_DAYS,
  MAX_PRIME_DATES,
  pickPrimeDates,
  primeCandidates,
  primeDatePlan,
  primeStretch,
  type PrimeDate,
  type PrimeGroup,
} from "./primeDates";
import { addDays, APP_TIME_ZONE, localDate, wallTime } from "./zone";

const TZ = APP_TIME_ZONE;
// Monday 2 November 2026, noon: tomorrow is the first day looked at.
const NOW = wallTime(2026, 10, 2, 12, TZ);
const at = (month: number, day: number, hours: number) =>
  new Date(wallTime(2026, month, day, hours, TZ)).toISOString();
const dayOf = (month: number, day: number) => wallTime(2026, month, day, 0, TZ);

/** Weekdays at work for five weeks: Ana 8 to 17, Bo 9 to 16. Ana is also busy Saturday 7 November 10 to 14. */
function workWeeks(): PrimeGroup["busy"] {
  const ana: { start: string; end: string }[] = [];
  const bo: { start: string; end: string }[] = [];
  for (let i = 0; i < 35; i++) {
    const { month: m, day: n, dow } = localDate(addDays(NOW, i, TZ), TZ);
    if (dow === 0 || dow === 6) continue;
    ana.push({ start: at(m, n, 8), end: at(m, n, 17) });
    bo.push({ start: at(m, n, 9), end: at(m, n, 16) });
  }
  ana.push({ start: at(10, 7, 10), end: at(10, 7, 14) });
  return { ana, bo };
}

function group(patch: Partial<PrimeGroup> = {}): PrimeGroup {
  return {
    id: "g",
    memberIds: ["ana", "bo"],
    busy: workWeeks(),
    connected: { ana: true, bo: true },
    eventDates: [],
    voting: false,
    ...patch,
  };
}

describe("freeGaps", () => {
  it("is what is left between the busy times, overlapping or not, in any order", () => {
    const busy = [
      { start: 50, end: 60 },
      { start: 10, end: 20 },
      { start: 15, end: 30 },
    ];
    expect(freeGaps(busy, 0, 100)).toEqual([
      { start: 0, end: 10 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ]);
    expect(freeGaps([{ start: 0, end: 200 }], 0, 100)).toEqual([]);
    expect(freeGaps([], 0, 100)).toEqual([{ start: 0, end: 100 }]);
  });
});

describe("primeCandidates", () => {
  it("puts a free weekend first, then a free Sunday, and a weekday evening far below", () => {
    const found = primeCandidates(group(), NOW, TZ);
    // Saturday 14 and Sunday 15 November, both free all day.
    expect(found[0]).toMatchObject({
      kind: "weekend",
      day: dayOf(10, 14),
      start: Date.parse(at(10, 14, 10)),
      end: Date.parse(at(10, 15, 22)),
    });
    // Sunday 8 November, 10 to 22 (its Saturday is half taken, so no weekend).
    expect(found[1]).toMatchObject({ kind: "hours", day: dayOf(10, 8) });
    expect(found.some((p) => p.kind === "weekend" && p.day === dayOf(10, 7))).toBe(false);
    // Tuesday's evening after work counts, but is worth much less.
    const tuesday = found.find((p) => p.day === dayOf(10, 3))!;
    expect(tuesday).toMatchObject({
      start: Date.parse(at(10, 3, 17)),
      end: Date.parse(at(10, 3, 22)),
    });
    expect(tuesday.value).toBeLessThan(found[1].value / 2);
  });

  it("starts and ends on the hour or the half hour, and needs at least four hours", () => {
    const busy = workWeeks();
    // Bo works until 17:10 on Wednesday 4 November: the evening starts 17:30.
    busy.bo.push({
      start: at(10, 4, 16),
      end: new Date(Date.parse(at(10, 4, 17)) + 600_000).toISOString(),
    });
    // And until 18:30 on Thursday 5 November: three and a half hours is too little.
    busy.bo.push({ start: at(10, 5, 16), end: at(10, 5, 18.5) });
    const found = primeCandidates(group({ busy }), NOW, TZ);
    expect(found.find((p) => p.day === dayOf(10, 4))?.start).toBe(Date.parse(at(10, 4, 17.5)));
    expect(found.some((p) => p.day === dayOf(10, 5))).toBe(false);
  });

  it("looks from tomorrow and three weeks on, no further", () => {
    const days = primeCandidates(group(), NOW, TZ).map((p) => p.day);
    expect(Math.min(...days)).toBe(addDays(NOW, 1, TZ));
    expect(Math.max(...days)).toBeLessThanOrEqual(addDays(NOW, LOOK_AHEAD_DAYS, TZ));
  });

  it("has none for a member with no calendar, a group of one, or a group already voting", () => {
    expect(primeCandidates(group({ connected: { ana: true, bo: false } }), NOW, TZ)).toEqual([]);
    expect(primeCandidates(group({ memberIds: ["ana"] }), NOW, TZ)).toEqual([]);
    expect(primeCandidates(group({ voting: true }), NOW, TZ)).toEqual([]);
  });

  it("leaves the days around the group's own events alone", () => {
    // An event on Wednesday 11 November: 8 to 14 November are out, that weekend too.
    const found = primeCandidates(
      group({ eventDates: [{ start: at(10, 11, 18), end: at(10, 11, 21) }] }),
      NOW,
      TZ,
    );
    for (let d = 8; d <= 14; d++) expect(found.some((p) => p.day === dayOf(10, d))).toBe(false);
    expect(found[0]).toMatchObject({ kind: "weekend", day: dayOf(10, 21) });
  });

  it("never offers Christmas or New Year", () => {
    const free = group({ busy: {} });
    const days = primeCandidates(free, wallTime(2026, 11, 15, 12, TZ), TZ).map((p) => p.day);
    for (const d of [23, 24, 25, 26, 31]) expect(days).not.toContain(dayOf(11, d));
    expect(days).not.toContain(wallTime(2027, 0, 1, 0, TZ));
    expect(days).toContain(dayOf(11, 22));
  });
});

describe("pickPrimeDates", () => {
  const date = (groupId: string, start: number, value: number): PrimeDate => ({
    groupId,
    kind: "hours",
    day: start,
    start,
    end: start + 1,
    value,
  });

  it("shows each group's best, the best groups first, a few at most", () => {
    const picked = pickPrimeDates([
      [date("a", 1, 0.5), date("a", 2, 0.9)],
      [date("b", 3, 0.7)],
      [],
      [date("c", 4, 0.2)],
      [date("d", 5, 0.95)],
    ]);
    expect(picked.map((p) => [p.groupId, p.start])).toEqual([
      ["d", 5],
      ["a", 2],
      ["b", 3],
    ]);
    expect(picked).toHaveLength(MAX_PRIME_DATES);
  });

  it("lets a low day score push a stretch below another", () => {
    const scores = new Map([["a", new Map([[2, 0]])]]);
    const [best] = pickPrimeDates([[date("a", 1, 0.6), date("a", 2, 0.9)]], scores);
    // 0.9 halved by a score of 0 is 0.45, below the 0.6 nobody's events touch.
    expect(best).toMatchObject({ start: 1, value: 0.6 });
  });
});

describe("primeDatePlan", () => {
  it("plans that one day, from the stretch's first whole hour to its end", () => {
    const evening: PrimeDate = {
      groupId: "g",
      kind: "hours",
      day: dayOf(10, 4),
      start: Date.parse(at(10, 4, 17.5)),
      end: Date.parse(at(10, 4, 22)),
      value: 0.3,
    };
    expect(primeDatePlan(evening, TZ)).toMatchObject({
      multiDay: false,
      anyTime: false,
      startHour: 18,
      durationMinutes: 240,
      period: { from: at(10, 4, 0), to: at(10, 4, 0), days: true },
    });
  });

  it("plans a weekend as Saturday and Sunday away", () => {
    const [weekend] = primeCandidates(group(), NOW, TZ);
    expect(primeDatePlan(weekend, TZ)).toEqual({
      multiDay: true,
      days: 2,
      startDow: 6,
      period: { from: at(10, 14, 0), to: at(10, 15, 0), days: true },
    });
  });
});

describe("primeStretch", () => {
  it("says when, how long, the weekday and month, the size and what the group is for", () => {
    const found = primeCandidates(group(), NOW, TZ);
    const tuesday = found.find((p) => p.day === dayOf(10, 3))!;
    expect(primeStretch(tuesday, { size: 2, about: "Løb" }, TZ)).toEqual({
      kind: "hours",
      startMinute: 17 * 60,
      minutes: 5 * 60,
      weekday: 2,
      month: 10,
      groupSize: 2,
      about: "Løb",
    });
    expect(primeStretch(found[0], { size: 2, about: null }, TZ)).toMatchObject({
      kind: "weekend",
      weekday: 6,
      about: "",
    });
  });
});
