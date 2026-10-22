import { describe, expect, it } from "vitest";

import { FLIGHT_TIMING as T, flightPlan } from "@/lib/sendFlight";

describe("flightPlan", () => {
  // Rows top to bottom: five sent (the top five), then three that weren't.
  const eight = [true, true, true, true, true, false, false, false];

  it("swipes the dates not sent off to the right first, from the bottom row up", () => {
    const { steps } = flightPlan(eight);
    expect(steps.slice(5).map((s) => s.move)).toEqual(["away", "away", "away"]);
    // The bottom row (7) goes first, then 6, then 5.
    expect(steps[7].delay).toBe(0);
    expect(steps[6].delay).toBeCloseTo(T.awayStagger);
    expect(steps[5].delay).toBeCloseTo(2 * T.awayStagger);
  });

  it("then flies the dates sent down into the tab, the bottom one first", () => {
    const { steps } = flightPlan(eight);
    expect(steps.slice(0, 5).map((s) => s.move)).toEqual(Array(5).fill("fly"));
    const delays = [4, 3, 2, 1, 0].map((row) => steps[row].delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(5);
    // None leaves before the swipes are nearly done (they overlap a little)...
    const lastAwayEnd = steps[5].delay + steps[5].duration;
    expect(Math.min(...delays)).toBeLessThan(lastAwayEnd);
    expect(Math.min(...delays)).toBeGreaterThan(steps[7].delay + steps[7].duration * 0.5);
  });

  it("ends when the last date has arrived", () => {
    const { steps, end } = flightPlan(eight);
    expect(end).toBeCloseTo(Math.max(...steps.slice(0, 5).map((s) => s.delay + s.duration)));
  });

  it("with every date sent there is nothing to swipe away: they fly at once", () => {
    const { steps, end } = flightPlan([true, true, true]);
    expect(steps.every((s) => s.move === "fly")).toBe(true);
    expect(steps[2].delay).toBe(0);
    expect(end).toBeCloseTo(2 * T.flyStagger + T.fly);
  });

  it("a long list is swiped away in no more than awaySpan to start them all", () => {
    const many = [...Array(5).fill(true), ...Array(30).fill(false)];
    const { steps } = flightPlan(many);
    const starts = steps.slice(5).map((s) => s.delay);
    expect(Math.max(...starts)).toBeLessThanOrEqual(T.awaySpan + 1e-9);
  });

  it("handles no dates and none sent", () => {
    expect(flightPlan([])).toEqual({ steps: [], end: 0 });
    const { steps, end } = flightPlan([false, false]);
    expect(steps.map((s) => s.move)).toEqual(["away", "away"]);
    expect(end).toBeGreaterThan(0);
  });
});
