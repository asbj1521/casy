import { describe, expect, it } from "vitest";

import { backToBackEnds, earlyMorningStarts } from "@/lib/earlyMorning";
import { findEventSlot } from "@/lib/eventSearch";
import { holidayBlocks, withHolidayBlocks } from "@/lib/holidayBlocks";
import type { Participant } from "@/types";

const TZ = "Europe/Copenhagen";
// Copenhagen is UTC+1 in winter: local 00:00 is 23:00 UTC the day before.
const NOW = Date.parse("2026-10-01T10:00:00.000Z");

const free = (name: string): Participant => ({ profileId: name.toLowerCase(), name, busy: [] });
const group = () => withHolidayBlocks([free("Alice"), free("Bob")], TZ, NOW);

function meeting(startHour: number, durationMinutes: number, from: string) {
  return findEventSlot(
    group(),
    { kind: "single", durationMinutes, startHour },
    from,
    "2027-02-01T00:00:00.000Z",
    TZ,
  ).slot;
}

describe("holidayBlocks", () => {
  it("blocks 23 to 26 December all day, and New Year's Eve 18:00 to 1 January 12:00, local time", () => {
    expect(holidayBlocks([2026], TZ)).toEqual([
      {
        start: "2026-12-22T23:00:00.000Z",
        end: "2026-12-26T23:00:00.000Z",
        priority: "never",
        holiday: true,
      },
      {
        start: "2026-12-31T17:00:00.000Z",
        end: "2027-01-01T11:00:00.000Z",
        priority: "never",
        holiday: true,
      },
    ]);
  });
});

describe("withHolidayBlocks", () => {
  it("adds last, this and next year's blocks to everyone, keeping their own", () => {
    const own = { start: "2026-11-02T08:00:00.000Z", end: "2026-11-02T16:00:00.000Z" };
    const [alice, bob] = withHolidayBlocks(
      [{ ...free("Alice"), busy: [own] }, free("Bob")],
      TZ,
      NOW,
    );
    expect(alice.busy[0]).toBe(own);
    expect(alice.busy).toHaveLength(1 + 3 * 2);
    expect(bob.busy).toHaveLength(3 * 2);
    // Last year's New Year reaches into this year's 1 January.
    expect(bob.busy.some((b) => b.end === "2026-01-01T11:00:00.000Z")).toBe(true);
    expect(bob.busy.some((b) => b.start === "2027-12-22T23:00:00.000Z")).toBe(true);
  });
});

describe("the searches with holiday blocks", () => {
  it("skips 23 to 26 December for a meeting", () => {
    // Searching from 22 December at noon: 10:00 is gone that day.
    expect(meeting(10, 120, "2026-12-22T11:00:00.000Z")?.start).toBe("2026-12-27T09:00:00.000Z");
  });

  it("allows New Year's Eve before 18:00, but not a meeting running into it", () => {
    expect(meeting(12, 120, "2026-12-31T00:00:00.000Z")?.start).toBe("2026-12-31T11:00:00.000Z");
    // 17:00 to 19:00 runs into the evening; 1 January 17:00 is after noon.
    expect(meeting(17, 120, "2026-12-31T00:00:00.000Z")?.start).toBe("2027-01-01T16:00:00.000Z");
  });

  it("keeps 1 January free only from 12:00", () => {
    expect(meeting(10, 120, "2026-12-31T23:00:00.000Z")?.start).toBe("2027-01-02T09:00:00.000Z");
    expect(meeting(12, 120, "2026-12-31T23:00:00.000Z")?.start).toBe("2027-01-01T11:00:00.000Z");
  });

  it("keeps a trip off Christmas", () => {
    // Three days from 21 December can't include the 23rd: 27 to 29 December.
    const { slot } = findEventSlot(
      group(),
      { kind: "vacation", days: 3 },
      "2026-12-20T23:00:00.000Z",
      "2026-12-30T23:00:00.000Z",
      TZ,
    );
    expect(slot?.start).toBe("2026-12-26T23:00:00.000Z");
  });

  it("leaves holiday blocks out of the edge warnings", () => {
    // Starts the moment the New Year block ends: nobody's own plans.
    const atNoon = { start: "2027-01-01T11:00:00.000Z", end: "2027-01-01T13:00:00.000Z" };
    expect(backToBackEnds(group(), atNoon, TZ)).toEqual([]);
    // Ends late on the 22nd, with Christmas starting at midnight.
    const late = { start: "2026-12-22T19:00:00.000Z", end: "2026-12-22T22:30:00.000Z" };
    expect(earlyMorningStarts(group(), late, TZ)).toEqual([]);
  });
});
