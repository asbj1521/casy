import { describe, expect, it } from "vitest";

import { isOutdated, parseVersion } from "./appVersion";

describe("parseVersion", () => {
  it("reads major.minor and major.minor.patch", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2")).toEqual([1, 2, 0]);
    expect(parseVersion(" 10.0.1 ")).toEqual([10, 0, 1]);
  });

  it("refuses anything else", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("v1.2.3")).toBeNull();
    expect(parseVersion("1")).toBeNull();
    expect(parseVersion("1.2.3.4")).toBeNull();
  });
});

describe("isOutdated", () => {
  it("compares part by part, numbers not text", () => {
    expect(isOutdated("1.0.0", "1.0.1")).toBe(true);
    expect(isOutdated("1.9.0", "1.10.0")).toBe(true);
    expect(isOutdated("2.0.0", "1.10.0")).toBe(false);
    expect(isOutdated("1.2.0", "1.2")).toBe(false);
  });

  it("never locks anyone out on a missing or unreadable minimum", () => {
    expect(isOutdated("1.0.0", null)).toBe(false);
    expect(isOutdated("1.0.0", "soon")).toBe(false);
    expect(isOutdated("dev", "2.0.0")).toBe(false);
  });
});
