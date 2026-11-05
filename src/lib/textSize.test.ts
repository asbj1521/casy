import { describe, expect, it } from "vitest";

import { rootPxFor } from "./textSize";

describe("rootPxFor", () => {
  it("leaves the page as drawn at iOS's default text size", () => {
    expect(rootPxFor(17)).toBe(16);
  });
  it("follows larger text sizes", () => {
    expect(rootPxFor(21)).toBeCloseTo(19.76, 2);
  });
  it("never goes below the page as drawn", () => {
    expect(rootPxFor(15)).toBe(16);
    expect(rootPxFor(14)).toBe(16);
  });
  it("stops at what the layout can take", () => {
    expect(rootPxFor(53)).toBe(21.6);
  });
});
