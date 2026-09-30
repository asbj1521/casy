import { describe, expect, it } from "vitest";

import { formatLongDate, formatLongSpan, formatLongSpanLines } from "@/lib/format";
import {
  DEFAULT_PRESETS,
  daysUntil,
  describeDays,
  fallbackTitleId,
  laterSlots,
  randomDefaultSettings,
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

  it("splits a span after \"til\" for the headline's two lines", () => {
    const start = "2026-10-08T22:00:00.000Z";
    const end = "2026-10-11T22:00:00.000Z";
    expect(formatLongSpanLines(start, end, "da")).toEqual(["Fredag 9. oktober til", "søndag 11. oktober"]);
    expect(formatLongSpanLines(start, end, "en")).toEqual(["Friday 9 October to", "Sunday 11 October"]);
    expect(formatLongSpanLines(start, "2026-10-09T22:00:00.000Z", "da")).toEqual(["Fredag 9. oktober"]);
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
