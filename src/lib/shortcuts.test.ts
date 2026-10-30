import { describe, expect, it } from "vitest";

import { randomDefaultSettings, type SchedulerSettings } from "@/lib/scheduler";
import { readShortcutPlan, shortcutPlan } from "@/lib/shortcuts";

const base = randomDefaultSettings(() => 0);
const settings: SchedulerSettings = {
  ...base,
  startHour: 7,
  durationMinutes: 90,
  dows: [1, 2, 3, 4, 5],
  period: { from: "2026-11", to: "2026-12" } as unknown as SchedulerSettings["period"],
};
const extras = { place: "Padelhallen", note: "", answerDays: 2, dateCount: 4 };
const people = { states: { a: "optional" as const }, atLeast: null };

describe("shortcuts (#175)", () => {
  it("keeps the plan less its months, and reads it back as it was", () => {
    const plan = shortcutPlan(settings, extras, people);
    expect(plan.settings).not.toHaveProperty("period");
    expect(readShortcutPlan(JSON.parse(JSON.stringify(plan)), base)).toEqual(plan);
  });

  it("takes the default for anything missing or of the wrong kind", () => {
    const read = readShortcutPlan(
      {
        v: 1,
        settings: { startHour: "seven", dows: [9, 2, 2], durationMinutes: 5 },
        extras: { answerDays: 12, dateCount: 4, place: 3 },
        people: { states: { a: "maybe", b: "out" }, atLeast: -1 },
      },
      base,
    );
    expect(read?.settings.startHour).toBe(base.startHour);
    expect(read?.settings.dows).toEqual([2]);
    expect(read?.settings.durationMinutes).toBe(base.durationMinutes);
    expect(read?.extras).toEqual({ place: "", note: "", answerDays: null, dateCount: 4 });
    expect(read?.people).toEqual({ states: { b: "out" }, atLeast: null });
  });

  it("reads something that isn't a plan as none", () => {
    for (const raw of [null, [], "plan", { v: 2, settings: {} }, { v: 1 }]) {
      expect(readShortcutPlan(raw, base)).toBeNull();
    }
  });
});
