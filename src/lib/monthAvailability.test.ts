import { describe, it, expect } from "vitest";

import type { EventSettings } from "@/lib/eventSearch";
import {
  monthAvailability,
  type DayCell,
  type MonthAvailability,
  type MonthAvailabilityOptions,
} from "@/lib/monthAvailability";
import type { EventCategory, Participant } from "@/types";

/**
 * Tests for the numbers behind the scheduling page's day chart.
 *
 * Everything works in fixed UTC instants, like the engine's tests, so results
 * never depend on the machine's timezone. June 2026 is the month under test.
 */

const YEAR = 2026;
const JUNE = 5; // 0-based

/** An 18:00 meeting of two hours: the default search here. */
const MEETING: EventSettings = { kind: "single", startHour: 18, durationMinutes: 120 };

const OPTIONS: MonthAvailabilityOptions = {
  // Local time equals UTC here, so the fixtures read in plain hours.
  timeZone: "UTC",
  // Well before the month under test, so no day counts as past unless asked.
  todayMs: Date.parse("2020-01-01T00:00:00.000Z"),
  windowEndMs: Date.parse("2027-01-01T00:00:00.000Z"),
};

function makeParticipant(name: string, busy: Array<[string, string, EventCategory?]>): Participant {
  return {
    profileId: name.toLowerCase(),
    name,
    busy: busy.map(([start, end, category]) => ({ start, end, category })),
  };
}

/** June 2026 for `search`. */
function june(
  participants: Participant[],
  search: EventSettings = MEETING,
  options: Partial<MonthAvailabilityOptions> = {},
): MonthAvailability {
  return monthAvailability(participants, search, YEAR, JUNE, { ...OPTIONS, ...options });
}

/** The entry for one day of the month. */
function day(month: MonthAvailability, dayOfMonth: number): DayCell {
  return month.days[dayOfMonth - 1];
}

describe("monthAvailability layout", () => {
  it("lists every day of the month, from the 1st", () => {
    const month = june([]);

    expect(month.label).toBe("Juni 2026");
    expect(month.days).toHaveLength(30);
    expect(month.days.map((d) => d.dayOfMonth)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    expect(day(month, 1).date).toBe("2026-06-01T00:00:00.000Z");
  });

  it("names the month in the locale given", () => {
    expect(june([], MEETING, { locale: "en-GB" }).label).toBe("June 2026");
  });

  it("marks days before today as past", () => {
    const month = june([], MEETING, { todayMs: Date.parse("2026-06-10T09:00:00.000Z") });

    expect(day(month, 9).isPast).toBe(true);
    expect(day(month, 10).isPast).toBe(false); // today is not past
    expect(day(month, 11).isPast).toBe(false);
  });

  it("reports how many participants there are", () => {
    expect(june([makeParticipant("Alice", []), makeParticipant("Bob", [])]).total).toBe(2);
  });
});

describe("monthAvailability for a single meeting", () => {
  it("counts only people free at the chosen hour", () => {
    // The meeting is 18:00-20:00. Alice is busy across it, Bob finishes before.
    const people = [
      makeParticipant("Alice", [["2026-06-03T19:00:00.000Z", "2026-06-03T21:00:00.000Z"]]),
      makeParticipant("Bob", [["2026-06-03T09:00:00.000Z", "2026-06-03T17:00:00.000Z"]]),
    ];

    const month = june(people);

    expect(day(month, 3).freeCount).toBe(1);
    expect(day(month, 4).freeCount).toBe(2); // nothing on the 4th
  });

  it("counts a meeting that runs past midnight against the next day too", () => {
    // A night out: 22:00 for four hours, ending 02:00 the following day.
    const people = [
      makeParticipant("Alice", [["2026-06-09T00:30:00.000Z", "2026-06-09T01:30:00.000Z"]]),
    ];

    const month = june(people, { kind: "single", startHour: 22, durationMinutes: 240 });

    // The 8th's meeting spills into the 9th, where Alice is busy.
    expect(day(month, 8).freeCount).toBe(0);
    expect(day(month, 9).freeCount).toBe(1);
  });

  it("excludes weekdays outside allowedDays", () => {
    // Fridays and Saturdays only (5 = Fri, 6 = Sat).
    const month = june([makeParticipant("Alice", [])], { ...MEETING, allowedDays: [5, 6] });

    expect(day(month, 5).excluded).toBe(false); // Friday
    expect(day(month, 6).excluded).toBe(false); // Saturday
    expect(day(month, 7).excluded).toBe(true); // Sunday
    expect(day(month, 7).freeCount).toBe(0);
  });
});

describe("monthAvailability for a meeting at any time", () => {
  const anyTime = (durationMinutes: number): EventSettings => ({
    kind: "single",
    startHour: 18,
    durationMinutes,
    anyTime: true,
  });

  it("finds a free stretch anywhere in the 10:00-22:00 window, not just at startHour", () => {
    // Alice is busy all morning but free from 14:00; the chosen startHour
    // (18:00) would also happen to work, but anyTime shouldn't need it to.
    const people = [
      makeParticipant("Alice", [["2026-06-03T00:00:00.000Z", "2026-06-03T14:00:00.000Z"]]),
    ];

    expect(day(june(people, anyTime(240)), 3).freeCount).toBe(1);
  });

  it("never counts a gap outside 10:00-22:00, even an all-night-free person", () => {
    // Busy exactly across the allowed window; free all night, which doesn't count.
    const people = [
      makeParticipant("Alice", [["2026-06-03T10:00:00.000Z", "2026-06-03T22:00:00.000Z"]]),
    ];

    expect(day(june(people, anyTime(60)), 3).freeCount).toBe(0);
  });

  it("still reports busy when no gap in the window is long enough", () => {
    // Only a 2h gap (20:00-22:00) is left in the window, but the meeting needs 4h.
    const people = [
      makeParticipant("Alice", [["2026-06-03T10:00:00.000Z", "2026-06-03T20:00:00.000Z"]]),
    ];

    expect(day(june(people, anyTime(240)), 3).freeCount).toBe(0);
  });

  it("counts someone free only by skipping as conditional", () => {
    const bob: Participant = {
      profileId: "bob",
      name: "Bob",
      busy: [
        { start: "2026-06-03T10:00:00.000Z", end: "2026-06-03T20:00:00.000Z", priority: "skip" },
      ],
    };

    // Without skipping, only a 2h gap remains in the window (20:00-22:00),
    // not enough for a 10h meeting; skipping opens the whole 12h window.
    const month = june([bob], anyTime(10 * 60));

    expect(day(month, 3).freeCount).toBe(0);
    expect(day(month, 3).conditionalCount).toBe(1);
  });
});

describe("monthAvailability for a holiday", () => {
  const HOLIDAY: EventSettings = { kind: "vacation", days: 3 };

  it("splits people who are away from people who would take time off", () => {
    const people = [
      // Away all day: a hard block rules the day out entirely.
      makeParticipant("Alice", [
        ["2026-06-15T00:00:00.000Z", "2026-06-16T00:00:00.000Z", "travel"],
      ]),
      // Work only: free, but conditionally.
      makeParticipant("Bob", [["2026-06-15T09:00:00.000Z", "2026-06-15T17:00:00.000Z", "work"]]),
      makeParticipant("Cara", []),
    ];

    const cell = day(june(people, HOLIDAY), 15);

    expect(cell.freeCount).toBe(1); // Cara
    expect(cell.conditionalCount).toBe(1); // Bob
    // Alice is neither: being away is not "free with effort".
    expect(cell.freeCount + cell.conditionalCount).toBe(2);
  });

  it("counts nobody on days past the end of the search window", () => {
    const month = june([makeParticipant("Alice", [])], HOLIDAY, {
      windowEndMs: Date.parse("2026-06-10T00:00:00.000Z"),
    });

    expect(day(month, 9).freeCount).toBe(1);
    expect(day(month, 10).freeCount).toBe(0); // beyond the window
  });
});

describe("monthAvailability for a weekend trip", () => {
  const TRIP: EventSettings = {
    kind: "trip",
    shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 }, // Friday to Sunday
  };

  it("excludes days outside the trip's weekly window", () => {
    const month = june([], TRIP);

    // June 2026: the 5th is a Friday, so Fri-Sun is the 5th to the 7th.
    expect(day(month, 5).excluded).toBe(false);
    expect(day(month, 6).excluded).toBe(false);
    expect(day(month, 7).excluded).toBe(false);
    expect(day(month, 8).excluded).toBe(true); // Monday
    expect(day(month, 4).excluded).toBe(true); // Thursday
  });

  it("only counts the first day from the departure hour", () => {
    // A workday ending at 17:00 does not touch a trip leaving at 17:00.
    const people = [
      makeParticipant("Alice", [["2026-06-05T09:00:00.000Z", "2026-06-05T17:00:00.000Z", "work"]]),
    ];

    const month = june(people, TRIP);

    expect(day(month, 5).freeCount).toBe(1);
    expect(day(month, 5).conditionalCount).toBe(0);
  });

  it("counts work overlapping the departure evening as conditional", () => {
    const people = [
      makeParticipant("Alice", [["2026-06-05T16:00:00.000Z", "2026-06-05T20:00:00.000Z", "work"]]),
    ];

    const month = june(people, TRIP);

    expect(day(month, 5).freeCount).toBe(0);
    expect(day(month, 5).conditionalCount).toBe(1);
  });
});

describe("monthAvailability in Copenhagen time", () => {
  const CPH = "Europe/Copenhagen";

  it("starts every day at local midnight, across the spring clock change", () => {
    const march = monthAvailability([], MEETING, YEAR, 2, { ...OPTIONS, timeZone: CPH });
    expect(day(march, 28).date).toBe("2026-03-27T23:00:00.000Z"); // CET
    expect(day(march, 29).date).toBe("2026-03-28T23:00:00.000Z"); // CET
    expect(day(march, 30).date).toBe("2026-03-29T22:00:00.000Z"); // CEST
  });

  it("counts who is free at 18:00 Danish time", () => {
    const people = [
      // Busy 18:00-20:00 in Copenhagen on 3 June (16:00-18:00 UTC).
      makeParticipant("Alice", [["2026-06-03T16:00:00.000Z", "2026-06-03T18:00:00.000Z"]]),
      makeParticipant("Bob", []),
    ];
    expect(day(june(people, MEETING, { timeZone: CPH }), 3).freeCount).toBe(1);
    // Read in UTC the same block is 16-18, over before an 18:00 UTC meeting.
    expect(day(june(people), 3).freeCount).toBe(2);
  });
});

describe("monthAvailability with calendar priorities", () => {
  it("counts someone whose only clash is skippable as free if skipping", () => {
    const alice = makeParticipant("Alice", []);
    const bob: Participant = {
      profileId: "bob",
      name: "Bob",
      busy: [
        { start: "2026-06-10T18:00:00.000Z", end: "2026-06-10T19:00:00.000Z", priority: "skip" },
      ],
    };
    const carol: Participant = {
      profileId: "carol",
      name: "Carol",
      busy: [
        { start: "2026-06-10T18:00:00.000Z", end: "2026-06-10T19:00:00.000Z", priority: "skip" },
        { start: "2026-06-10T19:00:00.000Z", end: "2026-06-10T20:00:00.000Z" },
      ],
    };

    const cell = day(june([alice, bob, carol]), 10);

    expect(cell.freeCount).toBe(1); // Alice
    expect(cell.conditionalCount).toBe(1); // Bob; Carol is busy regardless
  });
});
