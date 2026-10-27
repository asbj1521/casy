import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import { findPool, pickCandidates, rankCandidates } from "@/lib/candidates";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import type { FoundDate } from "@/lib/scheduler";
import { localDate, wallTime } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

const TZ = "Europe/Copenhagen";
/** Monday 12 October 2026, Danish midnight. */
const MONDAY = new Date(wallTime(2026, 9, 12, 0, TZ)).toISOString();
const END = new Date(wallTime(2026, 11, 1, 0, TZ)).toISOString();
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
    const picked = pickCandidates(group, EVENING, { first, end: END }, TZ);

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

    const picked = pickCandidates(group, EVENING, { first, end: END }, TZ);
    expect(picked).toHaveLength(5);
    expect(picked.slice(1).every((d) => d.conflicts.length === 0)).toBe(true);
    expect(picked.slice(1).every((d) => day(d).day >= 22)).toBe(true);
  });

  it("fills a short period with days next to each other rather than offer fewer", () => {
    const group = [person("a")];
    const first = firstFrom(group, EVENING);
    const end = new Date(wallTime(2026, 9, 16, 0, TZ)).toISOString();
    const picked = pickCandidates(group, EVENING, { first, end }, TZ);
    expect(picked.map((d) => day(d).day)).toEqual([12, 13, 14, 15]);
  });

  it("never lets two holidays overlap", () => {
    const holiday: EventSettings = { kind: "vacation", days: 3 };
    const group = [person("a"), person("b")];
    const first = firstFrom(group, holiday);
    const picked = pickCandidates(group, holiday, { first, end: END }, TZ);

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
    expect(pickCandidates(group, EVENING, { first, end }, TZ)).toEqual([first]);
  });
});

describe("rankCandidates", () => {
  it("hands back every date looked at, the first first, the chosen among them", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const { pool, chosen } = rankCandidates(group, EVENING, { first, end: END }, TZ);

    expect(pool[0]).toBe(first);
    expect(pool.length).toBeGreaterThan(chosen.length);
    for (const d of chosen) expect(pool).toContain(d);
    expect(chosen).toEqual(pickCandidates(group, EVENING, { first, end: END }, TZ));
  });

  it("hands back the chosen in the order chosen too: the date on screen first", () => {
    const group = [person("a"), person("b")];
    const first = firstFrom(group, EVENING);
    const { chosen, byPick } = rankCandidates(group, EVENING, { first, end: END }, TZ);

    expect(byPick[0]).toBe(first);
    expect([...byPick].sort((x, y) => Date.parse(x.slot.start) - Date.parse(y.slot.start))).toEqual(
      chosen,
    );
  });
});

describe("scores (#119)", () => {
  const group = [person("a"), person("b")];

  /** A score for each date in the pool, by its day of the month. */
  const scoresBy = (pool: FoundDate[], byDay: Record<number, number>) =>
    new Map(pool.map((d) => [d.slot.start, byDay[day(d).day] ?? 100] as const));

  it("takes the best-scoring clean dates, the date on screen still first", () => {
    const first = firstFrom(group, EVENING);
    const pool = [first, ...findPool(group, EVENING, { first, end: END }, TZ)];
    // The 14th, 16th and 18th are bad nights for someone; the 22nd on suit everyone.
    const scores = scoresBy(pool, { 14: 40, 16: 40, 18: 40, 20: 60 });
    const { byPick } = rankCandidates(group, EVENING, { first, end: END, scores }, TZ);

    expect(byPick[0]).toBe(first);
    const days = byPick.slice(1).map((d) => day(d).day);
    expect(days.every((d) => ![14, 16, 18].includes(d))).toBe(true);
    // Spacing still holds: no two meetings fewer than two days apart.
    const all = byPick.map((d) => day(d).day).sort((a, b) => a - b);
    expect(all.slice(1).every((d, i) => d - all[i] >= 2)).toBe(true);
  });

  it("changes nothing when every date scores the same, or when there are no scores", () => {
    const first = firstFrom(group, EVENING);
    const pool = [first, ...findPool(group, EVENING, { first, end: END }, TZ)];
    const plain = pickCandidates(group, EVENING, { first, end: END }, TZ);
    const flat = scoresBy(pool, {});
    expect(pickCandidates(group, EVENING, { first, end: END, scores: flat }, TZ)).toEqual(plain);
  });

  it("never lets a score lift a date that costs someone above one that costs nobody", () => {
    const classes: BusyInterval[] = Array.from({ length: 10 }, (_, i) => ({
      start: new Date(wallTime(2026, 9, 12 + i, 17, TZ)).toISOString(),
      end: new Date(wallTime(2026, 9, 12 + i, 22, TZ)).toISOString(),
      priority: "skip",
    }));
    const costly = [person("a"), person("b", classes)];
    const first = firstFrom(costly, EVENING);
    const pool = [first, ...findPool(costly, EVENING, { first, end: END }, TZ)];
    // The dates needing a skip score perfectly, the clean ones poorly: clean still wins.
    const scores = new Map(
      pool.map((d) => [d.slot.start, d.conflicts.length > 0 ? 100 : 30] as const),
    );
    const picked = pickCandidates(costly, EVENING, { first, end: END, scores }, TZ);
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
    const { byPick, chosen } = rankCandidates(group, AFTERNOON, { first: first(), end }, TZ);
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
