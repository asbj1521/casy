import { describe, expect, it } from "vitest";

import { randomDefaultSettings, type SchedulerSettings } from "@/lib/scheduler";
import { readShortcutPlan, shortcutPlan, timeOf } from "@/lib/shortcuts";

const base = randomDefaultSettings(() => 0);
const settings: SchedulerSettings = {
  ...base,
  startHour: 19,
  durationMinutes: 90,
  dows: [1, 2, 3, 4, 5],
  period: { from: "2026-11", to: "2026-12" } as unknown as SchedulerSettings["period"],
};
const extras = { place: "Padelhallen", note: "", answerDays: 2, dateCount: 4 };
const morning = { startHour: 7, startWindow: { from: 360, to: 480 }, anyTime: false };

describe("shortcuts (#175)", () => {
  it("keeps the plan less its months, its first time in the settings, and reads it back", () => {
    const plan = shortcutPlan(settings, extras, [morning, timeOf(settings)]);
    expect(plan.settings).not.toHaveProperty("period");
    expect(plan.settings.startHour).toBe(7);
    expect(plan.times.map((t) => t.startHour)).toEqual([7, 19]);
    expect(readShortcutPlan(JSON.parse(JSON.stringify(plan)), base)).toEqual(plan);
  });

  it("keeps three times at most", () => {
    const four = [morning, morning, morning, morning];
    expect(shortcutPlan(settings, extras, four).times).toHaveLength(3);
  });

  it("takes the default for anything missing or of the wrong kind", () => {
    const read = readShortcutPlan(
      {
        v: 1,
        settings: { startHour: "seven", dows: [9, 2, 2], durationMinutes: 5 },
        times: [{}, { startHour: 12, startWindow: { from: 900, to: 800 } }, "lunch"],
        extras: { answerDays: 12, dateCount: 4, place: 3 },
      },
      base,
    );
    expect(read?.settings.startHour).toBe(base.startHour);
    expect(read?.settings.dows).toEqual([2]);
    expect(read?.settings.durationMinutes).toBe(base.durationMinutes);
    expect(read?.times).toEqual([
      timeOf(read!.settings),
      { startHour: 12, startWindow: null, anyTime: base.anyTime },
    ]);
    expect(read?.extras).toEqual({ place: "", note: "", answerDays: null, dateCount: 4 });
  });

  it("reads something that isn't a plan as none", () => {
    for (const raw of [null, [], "plan", { v: 2, settings: {} }, { v: 1 }]) {
      expect(readShortcutPlan(raw, base)).toBeNull();
    }
  });
});
