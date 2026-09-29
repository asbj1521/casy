import { describe, expect, it } from "vitest";

import { findEventSlot, isEventSettings } from "@/lib/eventSearch";
import type { Participant } from "@/types";

const TZ = "UTC";
// Mon 22 June to Mon 13 July 2026.
const START = "2026-06-22T00:00:00.000Z";
const END = "2026-07-13T00:00:00.000Z";

function person(name: string, busy: Array<[string, string, string?]>): Participant {
  return {
    profileId: name.toLowerCase(),
    name,
    busy: busy.map(([start, end, category]) => ({
      start,
      end,
      ...(category ? { category: category as "work" } : {}),
    })),
  };
}

describe("findEventSlot", () => {
  it("finds a single meeting at the chosen hour on an allowed day", () => {
    const { slot, conflicts } = findEventSlot(
      [person("Alice", [["2026-06-22T18:00:00.000Z", "2026-06-22T21:00:00.000Z"]])],
      { kind: "single", durationMinutes: 180, startHour: 18 },
      START,
      END,
      TZ,
    );
    // Monday evening is taken, so Tuesday 18:00-21:00.
    expect(slot).toEqual({ start: "2026-06-23T18:00:00.000Z", end: "2026-06-23T21:00:00.000Z" });
    expect(conflicts).toEqual([]);
  });

  it("reports what a single meeting would have people skip", () => {
    const skippable = {
      start: "2026-06-22T12:00:00.000Z",
      end: "2026-06-22T13:00:00.000Z",
      priority: "skip" as const,
    };
    // Monday's lunch needs Alice to skip; the only other lunch is weeks away.
    const alice: Participant = {
      profileId: "alice",
      name: "Alice",
      busy: [skippable, { start: "2026-06-23T00:00:00.000Z", end: "2026-07-10T00:00:00.000Z" }],
    };
    const { slot, conflicts } = findEventSlot(
      [alice],
      { kind: "single", durationMinutes: 60, startHour: 12 },
      START,
      END,
      TZ,
    );
    expect(slot?.start).toBe("2026-06-22T12:00:00.000Z");
    expect(conflicts).toEqual([{ profileId: "alice", name: "Alice", events: [skippable] }]);
  });

  it("with anyTime, finds a free window wherever it falls instead of only at startHour", () => {
    // Alice is busy from local midnight until 14:00 on Monday, then free the
    // rest of the day. A fixed 18:00 start would also happen to work here,
    // but anyTime should land on the earliest big-enough gap, 14:00, not wait
    // for the chosen hour.
    const alice: Participant = {
      profileId: "alice",
      name: "Alice",
      busy: [{ start: "2026-06-22T00:00:00.000Z", end: "2026-06-22T14:00:00.000Z" }],
    };
    const { slot } = findEventSlot(
      [alice],
      { kind: "single", durationMinutes: 240, startHour: 18, anyTime: true },
      START,
      END,
      TZ,
    );
    expect(slot).toEqual({ start: "2026-06-22T14:00:00.000Z", end: "2026-06-22T18:00:00.000Z" });
  });

  it("with anyTime, never suggests a start outside 10:00-22:00 even if free all night", () => {
    // Alice is busy exactly across the allowed window on Monday, so Monday
    // has no fit; Tuesday she's entirely free, and the fit should land at
    // 10:00, not overnight even though she's free then too.
    const alice: Participant = {
      profileId: "alice",
      name: "Alice",
      busy: [{ start: "2026-06-22T10:00:00.000Z", end: "2026-06-22T22:00:00.000Z" }],
    };
    const { slot } = findEventSlot(
      [alice],
      { kind: "single", durationMinutes: 60, startHour: 18, anyTime: true },
      START,
      END,
      TZ,
    );
    expect(slot).toEqual({ start: "2026-06-23T10:00:00.000Z", end: "2026-06-23T11:00:00.000Z" });
  });

  it("only searches the allowed days of week", () => {
    const { slot } = findEventSlot(
      [person("Alice", [])],
      { kind: "single", durationMinutes: 60, startHour: 12, allowedDays: [6] },
      START,
      END,
      TZ,
    );
    expect(slot?.start).toBe("2026-06-27T12:00:00.000Z"); // the first Saturday
  });

  it("searching again from the day after a declined date gives the next one", () => {
    const settings = { kind: "single" as const, durationMinutes: 60, startHour: 18 };
    const first = findEventSlot([person("Alice", [])], settings, START, END, TZ);
    const next = findEventSlot(
      [person("Alice", [])],
      settings,
      "2026-06-23T00:00:00.000Z",
      END,
      TZ,
    );
    expect(first.slot?.start).toBe("2026-06-22T18:00:00.000Z");
    expect(next.slot?.start).toBe("2026-06-23T18:00:00.000Z");
  });

  it("runs trips through the weekly search and vacations through the day-span search", () => {
    const trip = findEventSlot(
      [person("Alice", [])],
      { kind: "trip", shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 } },
      START,
      END,
      TZ,
    );
    expect(trip.slot?.start).toBe("2026-06-26T17:00:00.000Z");

    const vacation = findEventSlot([person("Alice", [])], { kind: "vacation", days: 3 }, START, END, TZ);
    expect(vacation.slot).toEqual({
      start: "2026-06-22T00:00:00.000Z",
      end: "2026-06-25T00:00:00.000Z",
    });
  });
});

describe("isEventSettings", () => {
  it("accepts each kind in its proper shape", () => {
    expect(isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12 })).toBe(true);
    expect(
      isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, allowedDays: [5, 6] }),
    ).toBe(true);
    expect(
      isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, anyTime: true }),
    ).toBe(true);
    expect(
      isEventSettings({ kind: "trip", shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 } }),
    ).toBe(true);
    expect(isEventSettings({ kind: "vacation", days: 7 })).toBe(true);
  });

  it("rejects anything malformed", () => {
    expect(isEventSettings(null)).toBe(false);
    expect(isEventSettings({ kind: "party" })).toBe(false);
    expect(isEventSettings({ kind: "single", durationMinutes: 90 })).toBe(false);
    expect(isEventSettings({ kind: "single", durationMinutes: 90, startHour: 25 })).toBe(false);
    expect(isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, allowedDays: [9] })).toBe(false);
    expect(isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, anyTime: "yes" })).toBe(false);
    expect(isEventSettings({ kind: "trip", shape: { anchorDow: 5 } })).toBe(false);
    expect(isEventSettings({ kind: "vacation", days: 0 })).toBe(false);
  });
});
