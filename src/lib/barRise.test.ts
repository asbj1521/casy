import { describe, expect, it } from "vitest";

import { barRiseDelay, nextChartMotion, RISE_FULL } from "./barRise";

const view = { swapKey: "group-a", month: "2026-11-01", loading: false };

describe("nextChartMotion", () => {
  it("rises once the data arrives, even if the month moved too", () => {
    expect(nextChartMotion({ ...view, loading: true, month: "2026-12-01" }, view, null)).toEqual({
      kind: "rise",
    });
  });

  it("does nothing after a group switch: the fade covers it", () => {
    expect(nextChartMotion(view, { ...view, swapKey: "group-b" }, { kind: "rise" })).toBeNull();
  });

  it("does nothing when switching to a group whose calendars are still loading", () => {
    expect(nextChartMotion(view, { ...view, swapKey: "group-b", loading: true }, null)).toBeNull();
  });

  it("slides forward to a later month", () => {
    expect(nextChartMotion(view, { ...view, month: "2026-12-01" }, null)).toEqual({
      kind: "slide",
      back: false,
    });
  });

  it("slides back to an earlier month, across a year too", () => {
    expect(nextChartMotion(view, { ...view, month: "2026-10-01" }, null)).toEqual({
      kind: "slide",
      back: true,
    });
    const january = { ...view, month: "2027-01-01" };
    expect(nextChartMotion(january, { ...view, month: "2026-12-01" }, null)).toEqual({
      kind: "slide",
      back: true,
    });
  });

  it("keeps the current motion otherwise", () => {
    const current = { kind: "slide", back: true } as const;
    expect(nextChartMotion(view, { ...view }, current)).toBe(current);
  });
});

describe("barRiseDelay", () => {
  it("steps left to right", () => {
    expect(barRiseDelay(0)).toBeCloseTo(0.1);
    expect(barRiseDelay(10, RISE_FULL)).toBeCloseTo(0.5);
  });
});
