import { describe, expect, it } from "vitest";

import { pollDelay } from "./livePace";

const MIN = 60_000;

describe("pollDelay", () => {
  it("asks every 5 seconds for the first minute after activity", () => {
    expect(pollDelay(0)).toBe(5_000);
    expect(pollDelay(MIN - 1)).toBe(5_000);
  });

  it("slows to 15, then 30 seconds", () => {
    expect(pollDelay(MIN)).toBe(15_000);
    expect(pollDelay(3 * MIN - 1)).toBe(15_000);
    expect(pollDelay(3 * MIN)).toBe(30_000);
  });

  it("never waits longer than a minute", () => {
    expect(pollDelay(10 * MIN)).toBe(60_000);
    expect(pollDelay(24 * 60 * MIN)).toBe(60_000);
  });

  it("treats a clock that went backwards as fresh activity", () => {
    expect(pollDelay(-5_000)).toBe(5_000);
  });
});
