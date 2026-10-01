import { describe, expect, it } from "vitest";

import { accept, back, currentStep, forward, jump, restart } from "@/lib/answerSteps";

const MON = "2026-06-21T22:00:00.000Z";
const TUE = "2026-06-22T22:00:00.000Z";
const WED = "2026-06-23T22:00:00.000Z";

describe("answer steps", () => {
  it("starts from today, with nothing accepted", () => {
    expect(restart()).toEqual({ steps: [{ from: null }], index: 0, accepted: null });
    expect(currentStep(restart())).toEqual({ from: null });
    expect(currentStep(restart(MON))).toEqual({ from: MON });
  });

  it("steps forward by searching on, and back by replaying", () => {
    const twice = forward(forward(restart(), MON), TUE);
    expect(currentStep(twice).from).toBe(TUE);
    expect(currentStep(back(twice)).from).toBe(MON);
    expect(currentStep(back(back(twice))).from).toBe(null);
  });

  it("never steps back past the first date", () => {
    const first = restart();
    expect(back(first)).toBe(first);
  });

  it("replays the date it stepped back from rather than searching again", () => {
    const steppedBack = back(forward(forward(restart(), MON), TUE));
    // The new search start is ignored: Tuesday was already found.
    const again = forward(steppedBack, WED);
    expect(currentStep(again).from).toBe(TUE);
    expect(again.steps).toHaveLength(3);
  });

  it("drops the steps ahead when jumping from an earlier one", () => {
    const steppedBack = back(forward(forward(restart(), MON), TUE));
    const jumped = jump(steppedBack, WED, true);
    expect(jumped.steps).toEqual([
      { from: null },
      { from: MON, day: false },
      { from: WED, day: true },
    ]);
    expect(currentStep(back(jumped)).from).toBe(MON);
  });

  it("clears a sign-off on every move, since it was for the date on screen", () => {
    const signed = accept(forward(restart(), MON), "slot");
    expect(signed.accepted).toBe("slot");
    expect(forward(signed, TUE).accepted).toBe(null);
    expect(back(signed).accepted).toBe(null);
    expect(jump(signed, WED).accepted).toBe(null);
  });
});
