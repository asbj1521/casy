import { describe, expect, it } from "vitest";

import { formatLongDate, formatLongSpan } from "@/lib/format";
import {
  daysUntil,
  describeDays,
  fallbackTitleId,
  laterSlots,
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
};

describe("settingsToSearch", () => {
  it("is one meeting with the switch off, every day left unrestricted", () => {
    expect(settingsToSearch(BASE)).toEqual({
      kind: "single",
      durationMinutes: 180,
      startHour: 18,
      allowedDays: undefined,
    });
    expect(settingsToSearch({ ...BASE, dows: [5, 6] })).toMatchObject({ allowedDays: [5, 6] });
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
    expect(fallbackTitleId({ kind: "vacation", days: 7 })).toBe("vacation");
    expect(
      fallbackTitleId({ kind: "trip", shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 } }),
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
});
