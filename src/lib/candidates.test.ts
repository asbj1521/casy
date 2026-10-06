import { describe, expect, it } from "vitest";

import { pickCandidates } from "@/lib/candidates";
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
