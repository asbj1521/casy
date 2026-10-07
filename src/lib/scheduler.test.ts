import { describe, expect, it } from "vitest";

import { formatLongDate, formatLongSpan, formatLongSpanLines } from "@/lib/format";
import {
  answerKey,
  DEFAULT_PRESETS,
  daysUntil,
  describeDays,
  fallbackTitleId,
  laterSlots,
  NO_PEOPLE_CHOICE,
  peopleFromChoice,
  periodWindow,
  randomDefaultSettings,
  reviewAnswer,
  settingsToSearch,
  type SchedulerSettings,
} from "@/lib/scheduler";
import type { Participant } from "@/types";

const BASE: SchedulerSettings = {
  multiDay: false,
  startHour: 18,
  durationMinutes: 180,
  dows: [1, 2, 3, 4, 5, 6, 0],
  days: 3,
  startDow: 5,
  anyTime: false,
  period: null,
};

describe("settingsToSearch", () => {
  it("is one meeting with the switch off, every day left unrestricted", () => {
    expect(settingsToSearch(BASE)).toEqual({
      kind: "single",
      durationMinutes: 180,
      startHour: 18,
      anyTime: false,
      allowedDays: undefined,
    });
    expect(settingsToSearch({ ...BASE, dows: [5, 6] })).toMatchObject({ allowedDays: [5, 6] });
  });

  it("carries anyTime through instead of the fixed start hour", () => {
    expect(settingsToSearch({ ...BASE, anyTime: true })).toMatchObject({
      kind: "single",
      anyTime: true,
    });
  });

  it("is a trip from a set weekday with the switch on", () => {
    expect(settingsToSearch({ ...BASE, multiDay: true })).toEqual({
      kind: "trip",
      shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 },
    });
  });

  it("caps a trip tied to a weekday at a week", () => {
    const search = settingsToSearch({ ...BASE, multiDay: true, days: 12 });
    expect(search).toMatchObject({ kind: "trip", shape: { spanDays: 7 } });
  });

  it("is a holiday of whole days when it may start on any day", () => {
    expect(settingsToSearch({ ...BASE, multiDay: true, startDow: null, days: 12 })).toEqual({
      kind: "vacation",
      days: 12,
    });
  });
});

describe("fallbackTitleId", () => {
  it("names an unnamed event after its shape", () => {
    expect(fallbackTitleId({ kind: "single", durationMinutes: 60, startHour: 12 })).toBe("lunch");
    expect(fallbackTitleId({ kind: "single", durationMinutes: 60, startHour: 19 })).toBe("evening");
    expect(
      fallbackTitleId({ kind: "single", durationMinutes: 60, startHour: 12, anyTime: true }),
    ).toBe("meeting");
    expect(fallbackTitleId({ kind: "vacation", days: 7 })).toBe("vacation");
    expect(
      fallbackTitleId({
        kind: "trip",
        shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 },
      }),
    ).toBe("weekend");
  });
});

describe("describeDays", () => {
  it("names the common sets and lists the rest Monday first", () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toEqual({ kind: "all" });
    expect(describeDays([5, 4, 3, 2, 1])).toEqual({ kind: "weekdays" });
    expect(describeDays([0, 6])).toEqual({ kind: "weekends" });
    expect(describeDays([6, 5, 0])).toEqual({ kind: "list", dows: [5, 6, 0] });
  });
});

describe("daysUntil", () => {
  it("counts whole days, across a clock change too", () => {
    // Copenhagen midnights either side of the switch to winter time (25 October 2026).
    expect(daysUntil("2026-10-25T22:00:00.000Z", "2026-10-24T22:00:00.000Z")).toBe(1);
    expect(daysUntil("2026-10-26T23:00:00.000Z", "2026-10-24T22:00:00.000Z")).toBe(2);
    expect(daysUntil("2026-09-28T22:00:00.000Z", "2026-09-28T22:00:00.000Z")).toBe(0);
  });
});

describe("laterSlots", () => {
  it("chains the same search from the day after each date", () => {
    const alice: Participant = {
      profileId: "alice",
      name: "Alice",
      // Busy on the evening of Tue 23 June.
      busy: [{ start: "2026-06-23T18:00:00.000Z", end: "2026-06-23T21:00:00.000Z" }],
    };
    const later = laterSlots(
      [alice],
      { kind: "single", durationMinutes: 180, startHour: 18 },
      "2026-06-22T18:00:00.000Z",
      2,
      "2026-07-13T00:00:00.000Z",
      "UTC",
    );
    expect(later.map((r) => r.slot?.start)).toEqual([
      "2026-06-24T18:00:00.000Z",
      "2026-06-25T18:00:00.000Z",
    ]);
  });
});

describe("formatLongDate / formatLongSpan", () => {
  it("writes the headline date in each language", () => {
    // 18:00 Copenhagen time on Friday 9 October 2026.
    expect(formatLongDate("2026-10-09T16:00:00.000Z", "da")).toBe("Fredag 9. oktober");
    expect(formatLongDate("2026-10-09T16:00:00.000Z", "en")).toBe("Friday 9 October");
  });

  it("writes a span with the last whole day, and one day as itself", () => {
    // Local midnight Fri 9 October to the midnight after Sun 11 October.
    const start = "2026-10-08T22:00:00.000Z";
    const end = "2026-10-11T22:00:00.000Z";
    expect(formatLongSpan(start, end, "da")).toBe("Fredag 9. oktober til søndag 11. oktober");
    expect(formatLongSpan(start, end, "en")).toBe("Friday 9 October to Sunday 11 October");
    expect(formatLongSpan(start, "2026-10-09T22:00:00.000Z", "da")).toBe("Fredag 9. oktober");
  });

  it('splits a span after "til" for the headline\'s two lines', () => {
    const start = "2026-10-08T22:00:00.000Z";
    const end = "2026-10-11T22:00:00.000Z";
    expect(formatLongSpanLines(start, end, "da")).toEqual([
      "Fredag 9. oktober til",
      "søndag 11. oktober",
    ]);
    expect(formatLongSpanLines(start, end, "en")).toEqual([
      "Friday 9 October to",
      "Sunday 11 October",
    ]);
    expect(formatLongSpanLines(start, "2026-10-09T22:00:00.000Z", "da")).toEqual([
      "Fredag 9. oktober",
    ]);
  });
});

describe("randomDefaultSettings", () => {
  it("keeps every preset within the settings dropdowns", () => {
    for (const p of DEFAULT_PRESETS) {
      expect(Number.isInteger(p.startHour) && p.startHour >= 0 && p.startHour < 24).toBe(true);
      expect(p.durationMinutes % 30).toBe(0);
      expect(p.durationMinutes).toBeGreaterThanOrEqual(30);
      expect(p.durationMinutes).toBeLessThanOrEqual(720);
      expect(p.startHour * 60 + p.durationMinutes).toBeLessThanOrEqual(24 * 60);
    }
  });

  it("picks the preset the random value points at, first to last", () => {
    const first = randomDefaultSettings(() => 0);
    expect(first).toMatchObject(DEFAULT_PRESETS[0]);
    const last = randomDefaultSettings(() => 0.9999);
    expect(last).toMatchObject(DEFAULT_PRESETS[DEFAULT_PRESETS.length - 1]);
  });

  it("opens as a single meeting on every weekday, with the fixed trip defaults", () => {
    const s = randomDefaultSettings(() => 0.5);
    expect(s).toMatchObject({ multiDay: false, anyTime: false, days: 3, startDow: 5 });
    expect(describeDays(s.dows)).toEqual({ kind: "all" });
  });

  it("hands out its own weekday list, so editing it leaves the next one whole", () => {
    randomDefaultSettings(() => 0).dows.pop();
    expect(randomDefaultSettings(() => 0).dows).toHaveLength(7);
  });
});

describe("reviewAnswer", () => {
  const SLOT = { start: "2026-06-26T15:00:00.000Z", end: "2026-06-28T19:00:00.000Z" };
  const conflict = (profileId: string) => ({ profileId, name: profileId, events: [] });
  const meeting = settingsToSearch(BASE);
  const trip = settingsToSearch({ ...BASE, multiDay: true });

  it("has nothing to say without a date", () => {
    expect(reviewAnswer(null, meeting, "me", null).tone).toBe("none");
    expect(reviewAnswer({ slot: null, conflicts: [] }, trip, "me", null)).toEqual({
      tone: "none",
      yours: null,
      others: [],
      accepted: false,
      absent: [],
    });
  });

  it("is clean when nobody gives anything up", () => {
    expect(reviewAnswer({ slot: SLOT, conflicts: [] }, meeting, "me", null).tone).toBe("clean");
    expect(reviewAnswer({ slot: SLOT, conflicts: [] }, trip, "me", null).tone).toBe("clean");
  });

  it("calls a meeting someone must skip for a skip, whoever it is", () => {
    const yours = reviewAnswer({ slot: SLOT, conflicts: [conflict("me")] }, meeting, "me", null);
    expect(yours).toMatchObject({ tone: "skip", yours: { profileId: "me" }, others: [] });
    const theirs = reviewAnswer({ slot: SLOT, conflicts: [conflict("bo")] }, meeting, "me", null);
    expect(theirs).toMatchObject({ tone: "skip", yours: null, others: [{ profileId: "bo" }] });
  });

  it("asks you first when a trip costs you time off, then the others", () => {
    const found = { slot: SLOT, conflicts: [conflict("me"), conflict("bo")] };
    expect(reviewAnswer(found, trip, "me", null).tone).toBe("approve");
    expect(reviewAnswer(found, trip, "me", "another date").tone).toBe("approve");
    expect(reviewAnswer(found, trip, "me", SLOT.start)).toMatchObject({
      tone: "review",
      accepted: true,
    });
    const onlyYou = { slot: SLOT, conflicts: [conflict("me")] };
    expect(reviewAnswer(onlyYou, trip, "me", SLOT.start).tone).toBe("clean");
  });
});

describe("answerKey", () => {
  const slot = { start: "2026-10-09T16:00:00.000Z", end: "2026-10-09T18:00:00.000Z" };
  const skip = {
    profileId: "p1",
    name: "Maja",
    events: [{ start: "2026-10-09T15:00:00.000Z", end: "2026-10-09T17:00:00.000Z" }],
  };

  it("is the same for the same date on the same terms", () => {
    expect(answerKey({ slot: { ...slot }, conflicts: [] })).toBe(
      answerKey({ slot: { ...slot }, conflicts: [] }),
    );
  });

  it("changes when the date moves", () => {
    const later = { ...slot, start: "2026-10-10T16:00:00.000Z", end: "2026-10-10T18:00:00.000Z" };
    expect(answerKey({ slot, conflicts: [] })).not.toBe(answerKey({ slot: later, conflicts: [] }));
  });

  it("changes when the same date now costs someone something", () => {
    expect(answerKey({ slot, conflicts: [] })).not.toBe(
      answerKey({ slot, conflicts: [skip as never] }),
    );
  });

  it("calls no date the same whether nothing was found or nothing searched", () => {
    expect(answerKey(null)).toBe("none");
    expect(answerKey({ slot: null, conflicts: [] })).toBe("none");
  });
});

describe("periodWindow", () => {
  const TZ = "Europe/Copenhagen";
  const TODAY = "2026-10-06T22:00:00.000Z"; // 7 October, Danish midnight
  const LIMIT = { start: "2026-09-30T22:00:00.000Z", end: "2027-09-30T22:00:00.000Z" };

  it("covers the whole year from today with no period", () => {
    expect(periodWindow(null, TODAY, LIMIT, TZ)).toEqual({ start: TODAY, end: LIMIT.end });
  });

  it("runs from the first month's 1st to the end of the last month", () => {
    // December to January: 1 December to 1 February, Danish midnights.
    const period = { from: "2026-11-30T23:00:00.000Z", to: "2026-12-31T23:00:00.000Z" };
    expect(periodWindow(period, TODAY, LIMIT, TZ)).toEqual({
      start: "2026-11-30T23:00:00.000Z",
      end: "2027-01-31T23:00:00.000Z",
    });
  });

  it("never starts before today, nor ends after the year searched", () => {
    const period = { from: "2026-09-30T22:00:00.000Z", to: "2027-09-30T22:00:00.000Z" };
    expect(periodWindow(period, TODAY, LIMIT, TZ)).toEqual({ start: TODAY, end: LIMIT.end });
  });
});

describe("peopleFromChoice (#89)", () => {
  const members = ["a", "b", "c", "d"];

  it("is nothing at all while everyone is in and required", () => {
    expect(peopleFromChoice(members, NO_PEOPLE_CHOICE, true)).toBeUndefined();
    expect(
      peopleFromChoice(members, { states: { a: "required" }, atLeast: null }, true),
    ).toBeUndefined();
  });

  it("invites who is in, marks the optional, and keeps at least N within the required", () => {
    const choice = { states: { b: "optional", d: "out" } as const, atLeast: 5 };
    // a and c required: at least 5 is held to 2, which is everyone required: dropped.
    expect(peopleFromChoice(members, choice, true)).toEqual({
      members: ["a", "b", "c"],
      optional: ["b"],
    });
    expect(peopleFromChoice(members, { states: {}, atLeast: 3 }, true)).toEqual({
      members,
      optional: [],
      atLeast: 3,
    });
  });

  it("drops at least N for trips and holidays", () => {
    expect(peopleFromChoice(members, { states: {}, atLeast: 3 }, false)).toBeUndefined();
  });
});
