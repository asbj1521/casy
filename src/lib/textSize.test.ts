import { describe, expect, it } from "vitest";

import { rootPxFor } from "./textSize";

describe("rootPxFor", () => {
  it("leaves the page as drawn at iOS's default text size", () => {
    expect(rootPxFor(17)).toBe(16);
  });
  it("follows larger and smaller text sizes", () => {
    expect(rootPxFor(21)).toBeCloseTo(19.76, 2);
    expect(rootPxFor(15)).toBeCloseTo(14.12, 2);
  });
  it("stops at what the layout can take", () => {
    expect(rootPxFor(53)).toBe(21.6);
    expect(rootPxFor(10)).toBe(13.6);
  });
});
