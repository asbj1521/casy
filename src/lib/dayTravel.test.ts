import { describe, expect, it } from "vitest";

import { travelBlur, travelMs } from "@/lib/dayTravel";

describe("the glide between a vote's dates", () => {
  it("is quick, a little longer the further, and never long", () => {
    expect(travelMs(0)).toBe(0);
    expect(travelMs(1)).toBe(390);
    expect(travelMs(-1)).toBe(390);
    expect(travelMs(7)).toBe(630);
    expect(travelMs(60)).toBe(900);
  });

  it("blurs only what moves fast, and only so much", () => {
    expect(travelBlur(0)).toBe(0);
    expect(travelBlur(600)).toBe(0);
    expect(travelBlur(-1400)).toBe(2);
    expect(travelBlur(1400)).toBe(2);
    expect(travelBlur(50_000)).toBe(8);
  });
});
