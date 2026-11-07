import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import {
  findPool,
  findPoolAcross,
  pickCandidates,
  rankCandidates,
  rankFromPool,
} from "@/lib/candidates";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import type { FoundDate } from "@/lib/scheduler";
import { addDays, localDate, wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

const TZ = "Europe/Copenhagen";
/** Monday 12 October 2026, Danish midnight. */
const MONDAY = new Date(wallTime(2026, 9, 12, 0, TZ)).toISOString();
const END = new Date(wallTime(2026, 11, 1, 0, TZ)).toISOString();
/** The time now in these tests: before every date, so none is too soon (#178). */
const NOW = wallTime(2026, 9, 1, 12, TZ);
const EVENING: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };

const person = (name: string, busy: BusyInterval[] = []): Participant => ({
  profileId: name,
  name,
  busy,
});

function firstFrom(participants: Participant[], search: EventSettings, from = MONDAY): FoundDate {
  const found = findEventSlot(participants, search, from, END, TZ);
  if (!found.slot) throw new Error("no first date");
  return { slot: found.slot, conflicts: found.conflicts };
}

const day = (d: FoundDate) => localDate(Date.parse(d.slot.start), TZ);

describe("pickCandidates", () => {
  it("offers five meetings, the first on screen first, spread over different weekdays", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const picked = pickCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);

    expect(picked).toHaveLength(5);
    expect(picked[0]).toBe(first);
    const days = picked.map((d) => day(d).day);
    expect(days).toEqual([12, 14, 16, 18, 20]);
    expect(new Set(picked.map((d) => day(d).dow)).size).toBe(5);
  });

  it("prefers dates nobody has to skip anything for", () => {
    // b's skippable class every evening for ten days: the first date needs
    // it skipped, and clean dates only come after.
    const classes: BusyInterval[] = Array.from({ length: 10 }, (_, i) => ({
      start: new Date(wallTime(2026, 9, 12 + i, 17, TZ)).toISOString(),
      end: new Date(wallTime(2026, 9, 12 + i, 22, TZ)).toISOString(),
      priority: "skip",
    }));
    const group = [person("a"), person("b", classes)];
    const first = firstFrom(group, EVENING);
    expect(first.conflicts).not.toHaveLength(0);

    const picked = pickCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);
    expect(picked).toHaveLength(5);
    expect(picked.slice(1).every((d) => d.conflicts.length === 0)).toBe(true);
    expect(picked.slice(1).every((d) => day(d).day >= 22)).toBe(true);
  });

  it("fills a short period with days next to each other rather than offer fewer", () => {
    const group = [person("a")];
    const first = firstFrom(group, EVENING);
    const end = new Date(wallTime(2026, 9, 16, 0, TZ)).toISOString();
    const picked = pickCandidates(group, EVENING, { first, end, now: NOW }, TZ);
    expect(picked.map((d) => day(d).day)).toEqual([12, 13, 14, 15]);
  });

  it("never lets two holidays overlap", () => {
    const holiday: EventSettings = { kind: "vacation", days: 3 };
    const group = [person("a"), person("b")];
    const first = firstFrom(group, holiday);
    const picked = pickCandidates(group, holiday, { first, end: END, now: NOW }, TZ);

    expect(picked).toHaveLength(5);
    for (let i = 1; i < picked.length; i++) {
      expect(Date.parse(picked[i].slot.start)).toBeGreaterThanOrEqual(
        Date.parse(picked[i - 1].slot.end),
      );
    }
  });

  it("offers only the first date when nothing else fits", () => {
    const group = [person("a")];
    const first = firstFrom(group, EVENING);
    const end = new Date(wallTime(2026, 9, 13, 0, TZ)).toISOString();
    expect(pickCandidates(group, EVENING, { first, end, now: NOW }, TZ)).toEqual([first]);
  });
});

describe("rankCandidates", () => {
  it("hands back every date looked at, the first first, the chosen among them", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const { pool, chosen } = rankCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);

    expect(pool[0]).toBe(first);
    expect(pool.length).toBeGreaterThan(chosen.length);
    for (const d of chosen) expect(pool).toContain(d);
    expect(chosen).toEqual(pickCandidates(group, EVENING, { first, end: END, now: NOW }, TZ));
  });

  it("hands back the chosen in the order chosen too: the date on screen first", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const { chosen, byPick } = rankCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);

    expect(byPick[0]).toBe(first);
    expect([...byPick].sort((x, y) => Date.parse(x.slot.start) - Date.parse(y.slot.start))).toEqual(
      chosen,
    );
  });
});

describe("new weekdays (#234)", () => {
  // Only Saturdays are free for months; every other day opens up in February.
  const busyTill = wallTime(2027, 1, 1, 0, TZ);
  const busy: BusyInterval[] = [];
  for (let at = wallTime(2026, 9, 12, 0, TZ); at < busyTill; at = addDays(at, 1, TZ)) {
    if (localDate(at, TZ).dow === 6) continue;
    busy.push({
      start: new Date(at).toISOString(),
      end: new Date(addDays(at, 1, TZ)).toISOString(),
    });
  }
  const far = new Date(wallTime(2027, 2, 1, 0, TZ)).toISOString();

  it("are not worth going months ahead for: the near dates fill the vote", () => {
    const group = [person("a", busy), person("b")];
    const first = firstFrom(group, EVENING);
    const chosen = pickCandidates(group, EVENING, { first, end: far, now: NOW }, TZ);

    expect(chosen).toHaveLength(5);
    const sixWeeks = addDays(Date.parse(first.slot.start), 42, TZ);
    for (const d of chosen) expect(Date.parse(d.slot.start)).toBeLessThanOrEqual(sixWeeks);
  });

  it("still go on a new weekday within reach", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const chosen = pickCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);
    expect(new Set(chosen.map((d) => day(d).dow)).size).toBe(chosen.length);
  });

  it("a date far off is still offered when nothing nearer works", () => {
    const onlyOneSaturday = busy.concat(
      Array.from({ length: 16 }, (_, i) => {
        const at = addDays(wallTime(2026, 9, 24, 0, TZ), i * 7, TZ);
        return {
          start: new Date(at).toISOString(),
          end: new Date(addDays(at, 1, TZ)).toISOString(),
        };
      }),
    );
    const group = [person("a", onlyOneSaturday), person("b")];
    const first = firstFrom(group, EVENING);
    const chosen = pickCandidates(group, EVENING, { first, end: far, now: NOW }, TZ);
    expect(chosen.length).toBeGreaterThan(1);
    expect(day(chosen[1]).month).toBe(1);
  });
});

describe("a genvej's times", () => {
  // The morning costs less than the evening, so ranking alone would take only mornings.
  const MORNING: EventSettings = { kind: "single", durationMinutes: 90, startHour: 8 };
  const LATE: EventSettings = { kind: "single", durationMinutes: 90, startHour: 19 };
  const hour = (d: FoundDate) =>
    new Date(d.slot.start).toLocaleString("da-DK", {
      hour: "2-digit",
      timeZone: TZ,
    });
  const group = [person("a"), person("b")];

  for (const priority of ["hassle", "soon"] as const) {
    it(`gets a date at each of them, picking by ${priority}`, () => {
      const first = firstFrom(group, MORNING);
      const base = { first, end: END, now: NOW, priority };
      const pool = findPoolAcross(group, [MORNING, LATE], base, TZ);
      const { chosen } = rankFromPool(pool, group, MORNING, { ...base, everyTime: true }, TZ);
      expect(new Set(chosen.map(hour)).size).toBe(2);
    });
  }

  it("never takes a date that costs someone just to reach another time", () => {
    // Every evening needs a skip, every morning is clean.
    const skips: BusyInterval[] = Array.from({ length: 40 }, (_, i) => {
      const at = addDays(wallTime(2026, 9, 12, 0, TZ), i, TZ);
      return {
        start: new Date(at + 18 * 3_600_000).toISOString(),
        end: new Date(at + 22 * 3_600_000).toISOString(),
        priority: "skip",
      };
    });
    const costly = [person("a"), person("b", skips)];
    const first = firstFrom(costly, MORNING);
    const base = { first, end: END, now: NOW };
    const pool = findPoolAcross(costly, [MORNING, LATE], base, TZ);
    const { chosen } = rankFromPool(pool, costly, MORNING, { ...base, everyTime: true }, TZ);
    expect(chosen.every((d) => d.conflicts.length === 0)).toBe(true);
  });
});

describe("the soonest (#234)", () => {
  it("takes the earliest dates that keep the spacing, even one that needs a skip", () => {
    // Every evening clean but Thursday the 15th, where b has something skippable.
    const b = person("b", [
      {
        start: new Date(wallTime(2026, 9, 15, 17, TZ)).toISOString(),
        end: new Date(wallTime(2026, 9, 15, 23, TZ)).toISOString(),
        priority: "skip",
      },
    ]);
    const group = [person("a"), b];
    const first = firstFrom(group, EVENING);
    const options = { first, end: END, now: NOW };
    const soonest = pickCandidates(group, EVENING, { ...options, priority: "soon" }, TZ);

    const days = soonest.map((d) => day(d).day);
    expect(days).toEqual([...days].sort((x, y) => x - y));
    for (let i = 1; i < soonest.length; i++)
      expect(days[i] - days[i - 1]).toBeGreaterThanOrEqual(2);
    // No later than the good ones would be, which go looking for new weekdays.
    const good = pickCandidates(group, EVENING, options, TZ);
    expect(Date.parse(soonest.at(-1)!.slot.start)).toBeLessThanOrEqual(
      Date.parse(good.at(-1)!.slot.start),
    );
  });

  it("asked for nothing, picks as it always has", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const options = { first, end: END, now: NOW };
    expect(pickCandidates(group, EVENING, options, TZ)).toEqual(
      pickCandidates(group, EVENING, { ...options, priority: "hassle" }, TZ),
    );
  });
});

describe("comfort (#178)", () => {
  it("passes over a date that only just fits for one that leaves room around it", () => {
    // b works until 17:50 on Wednesday 14: the evening there is a rush.
    const work: BusyInterval = {
      start: new Date(wallTime(2026, 9, 14, 9, TZ)).toISOString(),
      end: new Date(wallTime(2026, 9, 14, 17 + 50 / 60, TZ)).toISOString(),
      category: "work",
    };
    const group = [person("a"), person("b", [work])];
    const first = firstFrom(group, EVENING);
    const { byPick } = rankCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);
    expect(byPick.map((d) => day(d).day)).not.toContain(14);
  });

  it("rates a year of busy calendars for a whole pool without a noticeable wait", () => {
    // Five people with four blocks a day for a year.
    const year = (name: string) =>
      person(
        name,
        Array.from({ length: 365 * 4 }, (_, i) => ({
          start: new Date(
            wallTime(2026, 9, 1 + Math.floor(i / 4), 7 + (i % 4) * 3, TZ),
          ).toISOString(),
          end: new Date(
            wallTime(2026, 9, 1 + Math.floor(i / 4), 8 + (i % 4) * 3, TZ),
          ).toISOString(),
        })),
      );
    const group = ["a", "b", "c", "d", "e"].map(year);
    const first = firstFrom(group, EVENING);
    const pool = findPool(group, EVENING, { first, end: END }, TZ);
    const started = performance.now();
    rankFromPool(pool, group, EVENING, { first, end: END, now: NOW }, TZ);
    // About 10 ms on a laptop; the bound only catches a rule gone quadratic.
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe("scores (#119)", () => {
  const group = [person("a"), person("b")];

  /** A score for each date in the pool, by its day of the month. */
  const scoresBy = (pool: FoundDate[], byDay: Record<number, number>) =>
    new Map(pool.map((d) => [d.slot.start, byDay[day(d).day] ?? 100] as const));

  it("takes the best-scoring clean dates, the date on screen still first", () => {
    const first = firstFrom(group, EVENING);
    const pool = [first, ...findPool(group, EVENING, { first, end: END, now: NOW }, TZ)];
    // The 14th, 16th and 18th are bad nights for someone; the 22nd on suit everyone.
    const scores = scoresBy(pool, { 14: 40, 16: 40, 18: 40, 20: 60 });
    const { byPick } = rankCandidates(group, EVENING, { first, end: END, scores, now: NOW }, TZ);

    expect(byPick[0]).toBe(first);
    const days = byPick.slice(1).map((d) => day(d).day);
    expect(days.every((d) => ![14, 16, 18].includes(d))).toBe(true);
    // Spacing still holds: no two meetings fewer than two days apart.
    const all = byPick.map((d) => day(d).day).sort((a, b) => a - b);
    expect(all.slice(1).every((d, i) => d - all[i] >= 2)).toBe(true);
  });

  it("changes nothing when every date scores the same, or when there are no scores", () => {
    const first = firstFrom(group, EVENING);
    const pool = [first, ...findPool(group, EVENING, { first, end: END, now: NOW }, TZ)];
    const plain = pickCandidates(group, EVENING, { first, end: END, now: NOW }, TZ);
    const flat = scoresBy(pool, {});
    expect(pickCandidates(group, EVENING, { first, end: END, scores: flat, now: NOW }, TZ)).toEqual(
      plain,
    );
  });

  it("never lets a score lift a date that costs someone above one that costs nobody", () => {
    const classes: BusyInterval[] = Array.from({ length: 10 }, (_, i) => ({
      start: new Date(wallTime(2026, 9, 12 + i, 17, TZ)).toISOString(),
      end: new Date(wallTime(2026, 9, 12 + i, 22, TZ)).toISOString(),
      priority: "skip",
    }));
    const costly = [person("a"), person("b", classes)];
    const first = firstFrom(costly, EVENING);
    const pool = [first, ...findPool(costly, EVENING, { first, end: END, now: NOW }, TZ)];
    // The dates needing a skip score perfectly, the clean ones poorly: clean still wins.
    const scores = new Map(
      pool.map((d) => [d.slot.start, d.conflicts.length > 0 ? 100 : 30] as const),
    );
    const picked = pickCandidates(costly, EVENING, { first, end: END, scores, now: NOW }, TZ);
    expect(picked.slice(1).every((d) => d.conflicts.length === 0)).toBe(true);
  });
});

describe("1 January (#166)", () => {
  // Wednesday 30 December 2026 to Saturday 2 January 2027, 15:00 to 17:00: a short period.
  const AFTERNOON: EventSettings = { kind: "single", durationMinutes: 120, startHour: 15 };
  const from = new Date(wallTime(2026, 11, 30, 0, TZ)).toISOString();
  const end = new Date(wallTime(2027, 0, 3, 0, TZ)).toISOString();
  const group = [person("a"), person("b")];
  const party: EventImpact = {
    v: 1,
    effects: ["alcohol"],
    runsLate: true,
    strain: "moderate",
    recoveryDays: 1,
    outdoors: false,
    daylight: false,
    confidence: "high",
    reason: "",
  };
  const date = (d: FoundDate) => `${day(d).month + 1}/${day(d).day}`;
  const first = () => {
    const found = findEventSlot(group, AFTERNOON, from, end, TZ);
    return { slot: found.slot!, conflicts: found.conflicts };
  };

  it("offers a small plan there only after every other date", () => {
    const { byPick, chosen } = rankCandidates(
      group,
      AFTERNOON,
      { first: first(), end, now: NOW },
      TZ,
    );
    // Picked last of all, though by the spacing rules it would come second.
    expect(byPick.map(date).at(-1)).toBe("1/1");
    expect(chosen.map(date)).toEqual(["12/30", "12/31", "1/1", "1/2"]);
  });

  it("never offers a big plan there", () => {
    const { chosen } = rankCandidates(
      group,
      AFTERNOON,
      { first: first(), end, profile: party },
      TZ,
    );
    expect(chosen.map(date)).toEqual(["12/30", "12/31", "1/2"]);
  });

  it("keeps it when it is the date on screen, picked by hand", () => {
    const onScreen = findEventSlot(
      group,
      AFTERNOON,
      new Date(wallTime(2027, 0, 1, 0, TZ)).toISOString(),
      end,
      TZ,
    );
    const { byPick } = rankCandidates(
      group,
      AFTERNOON,
      { first: { slot: onScreen.slot!, conflicts: [] }, end, profile: party },
      TZ,
    );
    expect(byPick.map(date)[0]).toBe("1/1");
  });
});

describe("findPoolAcross (#175)", () => {
  it("merges a genvej's times into one pool, soonest first, each moment once", () => {
    const group = [person("a")];
    const morning: EventSettings = { kind: "single", durationMinutes: 120, startHour: 8 };
    const evening: EventSettings = { kind: "single", durationMinutes: 120, startHour: 19 };
    const first = firstFrom(group, morning);
    const end = new Date(wallTime(2026, 9, 16, 0, TZ)).toISOString();
    const pool = findPoolAcross(group, [morning, evening, evening], { first, end }, TZ);
    const hours = pool.map((d) => localDate(Date.parse(d.slot.start), TZ));
    // From the day after the first, a morning and an evening each day.
    expect(pool).toHaveLength(6);
    expect(new Set(pool.map((d) => d.slot.start)).size).toBe(6);
    expect([...pool].sort((x, y) => Date.parse(x.slot.start) - Date.parse(y.slot.start))).toEqual(
      pool,
    );
    expect(hours.map((h) => h.day)).toEqual([13, 13, 14, 14, 15, 15]);
  });

  it("is findPool itself for one search", () => {
    const group = [person("a")];
    const first = firstFrom(group, EVENING);
    expect(findPoolAcross(group, [EVENING], { first, end: END }, TZ)).toEqual(
      findPool(group, EVENING, { first, end: END }, TZ),
    );
  });
});
