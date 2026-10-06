import { describe, expect, it } from "vitest";

import type { DaySegment } from "@/lib/calendarOverview";
import { firstHour, placeBlocks, placeSpan, STRIP_FIRST_HOUR } from "@/lib/dayStrip";
import { wallTime } from "@/lib/zone";

const TZ = "Europe/Copenhagen";
const at = (day: number, hour: number) => wallTime(2026, 9, day, hour, TZ);

function seg(day: number, from: number, to: number, allDay = false): DaySegment {
  return {
    calendarId: "c",
    start: new Date(at(day, from)),
    end: new Date(at(day, to)),
    allDay,
    continuesBefore: false,
    continuesAfter: false,
  };
}

describe("placeSpan", () => {
  it("places 18:00 to 21:00 on a 07:00 to 24:00 axis", () => {
    const { top, height } = placeSpan(at(14, 18), at(14, 21), at(14, 0), 7, TZ);
    expect(top).toBeCloseTo(11 / 17);
    expect(height).toBeCloseTo(3 / 17);
  });

  it("measures on the wall clock on the day the clocks go back", () => {
    // 25 October 2026 has 25 hours: 18:00 is still 11/17 down a 07-24 axis.
    const { top } = placeSpan(at(25, 18), at(25, 19), at(25, 0), 7, TZ);
    expect(top).toBeCloseTo(11 / 17);
  });

  it("clips what runs past the axis", () => {
    const { top, height } = placeSpan(at(14, 5), at(14, 8), at(14, 0), 7, TZ);
    expect(top).toBe(0);
    expect(height).toBeCloseTo(1 / 17);
  });
});

describe("firstHour", () => {
  it("starts at the usual hour unless something starts earlier", () => {
    expect(firstHour([{ midnight: at(14, 0), segments: [seg(14, 9, 17)] }], null, TZ)).toBe(
      STRIP_FIRST_HOUR,
    );
    expect(firstHour([{ midnight: at(14, 0), segments: [seg(14, 5.5, 8)] }], null, TZ)).toBe(5);
  });

  it("ignores all-day entries, but not an early suggested date", () => {
    const allDay = [{ midnight: at(14, 0), segments: [seg(14, 0, 24, true)] }];
    expect(firstHour(allDay, null, TZ)).toBe(STRIP_FIRST_HOUR);
    expect(firstHour(allDay, { start: at(14, 6), midnight: at(14, 0) }, TZ)).toBe(6);
  });
});

describe("placeBlocks", () => {
  it("puts overlapping blocks side by side and leaves out all-day ones", () => {
    const placed = placeBlocks(
      [seg(14, 9, 12), seg(14, 10, 11), seg(14, 13, 14), seg(14, 0, 24, true)],
      at(14, 0),
      7,
      TZ,
    );
    expect(placed.map((p) => [p.lane, p.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
    ]);
  });
});
