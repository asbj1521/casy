import { describe, expect, it } from "vitest";

import { parseRgb } from "@/lib/nativeGlass";

describe("parseRgb", () => {
  it("reads a computed colour", () => {
    expect(parseRgb("rgb(234, 88, 12)", [0, 0, 0])).toEqual([234, 88, 12]);
    expect(parseRgb("rgba(194, 65, 12, 0.5)", [0, 0, 0])).toEqual([194, 65, 12]);
  });

  it("takes the fallback for anything else", () => {
    expect(parseRgb("", [1, 2, 3])).toEqual([1, 2, 3]);
    expect(parseRgb("transparent", [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
