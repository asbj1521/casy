import { describe, expect, it } from "vitest";

import { SCENES, SIZE, type Device } from "@/components/appleWalkthrough/layout";
import { BEATS, keyBeat } from "@/components/appleWalkthrough/timeline";

const DEVICES: Device[] = ["mac", "iphone"];

describe.each(DEVICES)("the %s timeline", (device) => {
  const beats = BEATS[device];

  it("plays every scene once, in order", () => {
    const order = beats.map((b) => b.scene).filter((s, i, all) => s !== all[i - 1]);
    expect(order).toEqual(SCENES);
  });

  it("has exactly one key beat per scene, which the dots and arrows jump to", () => {
    for (const scene of SCENES) {
      expect(beats.filter((b) => b.scene === scene && b.key)).toHaveLength(1);
      expect(keyBeat(beats, scene)).toBeGreaterThanOrEqual(0);
    }
  });

  it("only points inside the drawing", () => {
    const { w, h } = SIZE[device];
    for (const { at } of beats) {
      expect(at[0]).toBeGreaterThanOrEqual(0);
      expect(at[0]).toBeLessThanOrEqual(w);
      expect(at[1]).toBeGreaterThanOrEqual(0);
      expect(at[1]).toBeLessThanOrEqual(h);
    }
  });

  it("gives every beat time on screen", () => {
    for (const beat of beats) expect(beat.ms).toBeGreaterThan(0);
  });
});

it("presses and holds only on the phone, where copying needs it", () => {
  expect(BEATS.mac.some((b) => b.press)).toBe(false);
  expect(BEATS.iphone.some((b) => b.press)).toBe(true);
});
