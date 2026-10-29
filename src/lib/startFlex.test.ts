import { describe, expect, it } from "vitest";

import { randomDefaultSettings } from "@/lib/scheduler";
import { flexOf, flexWindow } from "@/lib/startFlex";

describe("start flexibility (#173)", () => {
  it("is a window around the hour, clamped to the day", () => {
    expect(flexWindow(17, 0)).toBeNull();
    expect(flexWindow(17, 60)).toEqual({ from: 16 * 60, to: 18 * 60 });
    expect(flexWindow(0, 120)).toEqual({ from: 0, to: 120 });
    expect(flexWindow(23, 60)).toEqual({ from: 22 * 60, to: 23 * 60 + 30 });
  });

  it("reads back what was set, and not a window set otherwise", () => {
    const at17 = { ...randomDefaultSettings(() => 0), startHour: 17 };
    expect(flexOf(at17)).toBe(0);
    expect(flexOf({ ...at17, startWindow: flexWindow(17, 30) })).toBe(30);
    expect(flexOf({ ...at17, startHour: 23, startWindow: flexWindow(23, 120) })).toBe(120);
    // The AI's dinner window starts at its hour: not "give or take".
    expect(flexOf({ ...at17, startHour: 18, startWindow: { from: 1080, to: 1260 } })).toBeNull();
  });
});
