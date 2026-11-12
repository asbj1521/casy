import { describe, expect, it } from "vitest";

import { reviewDue } from "@/lib/appReview";

const DAY = 24 * 3_600_000;
const NOW = Date.parse("2026-11-12T12:00:00.000Z");

describe("reviewDue (#256)", () => {
  it("asks the first time, and again only after four months", () => {
    expect(reviewDue(null, NOW)).toBe(true);
    expect(reviewDue(new Date(NOW - 10 * DAY).toISOString(), NOW)).toBe(false);
    expect(reviewDue(new Date(NOW - 119 * DAY).toISOString(), NOW)).toBe(false);
    expect(reviewDue(new Date(NOW - 120 * DAY).toISOString(), NOW)).toBe(true);
  });

  it("asks when what was kept can't be read", () => {
    expect(reviewDue("not a time", NOW)).toBe(true);
  });
});
