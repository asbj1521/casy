import { describe, expect, it } from "vitest";

import {
  columnOf,
  daysBetween,
  daysInView,
  drawnDays,
  mondayOf,
  openingOf,
} from "@/lib/dayColumns";
import { APP_TIME_ZONE, atHour } from "@/lib/zone";

const TZ = APP_TIME_ZONE;
const midnight = (y: number, m: number, d: number) => atHour(Date.UTC(y, m - 1, d, 12), 0, TZ);

describe("day columns", () => {
  it("puts the picked day in the middle of three, as the swipe screen has it", () => {
    expect(daysInView(0, 3, "middle")).toEqual([-1, 0, 1]);
    expect(daysInView(4, 3, "middle")).toEqual([3, 4, 5]);
    expect(drawnDays(0, 3, "middle", 2)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    // Day -1 is the first column at offset 0, as it always was.
    expect(columnOf(-1, 3, "middle")).toBe(0);
    expect(columnOf(1, 3, "middle")).toBe(2);
  });

  it("puts the picked day first with one or two, as the home page has it", () => {
    expect(daysInView(0, 1, "first")).toEqual([0]);
    expect(daysInView(0, 2, "first")).toEqual([0, 1]);
    expect(daysInView(-3, 2, "first")).toEqual([-3, -2]);
    expect(drawnDays(0, 2, "first", 1)).toEqual([-1, 0, 1, 2]);
    expect(columnOf(0, 2, "first")).toBe(0);
    expect(columnOf(5, 1, "first")).toBe(5);
  });

  it("at any offset, the first day in view sits at the strip's start once moved", () => {
    for (const [days, lead] of [
      [1, "first"],
      [2, "first"],
      [3, "middle"],
    ] as const) {
      for (const offset of [-9, -1, 0, 2, 30]) {
        expect(columnOf(daysInView(offset, days, lead)[0], days, lead) - offset).toBe(0);
      }
    }
  });

  it("counts days across the clocks going back", () => {
    // 25 October 2026 is 25 hours long in Denmark.
    expect(daysBetween(midnight(2026, 10, 24), midnight(2026, 10, 26))).toBe(2);
    expect(daysBetween(midnight(2026, 10, 26), midnight(2026, 10, 24))).toBe(-2);
  });

  it("finds the Monday of a day's week", () => {
    // Thursday 29 October 2026; Sunday 1 November.
    expect(mondayOf(midnight(2026, 10, 29), TZ)).toBe(midnight(2026, 10, 26));
    expect(mondayOf(midnight(2026, 11, 1), TZ)).toBe(midnight(2026, 10, 26));
    expect(mondayOf(midnight(2026, 10, 26), TZ)).toBe(midnight(2026, 10, 26));
  });

  it("opens on the time now, else an hour before the first event, else 08:00", () => {
    expect(openingOf({ now: 0.8, firstEvent: 0.4 })).toEqual({ middle: 0.8 });
    expect(openingOf({ now: null, firstEvent: 10 / 24 })).toEqual({ top: 9 / 24 });
    expect(openingOf({ now: null, firstEvent: 0.01 })).toEqual({ top: 0 });
    expect(openingOf({ now: null, firstEvent: null })).toEqual({ top: 8 / 24 });
  });
});
