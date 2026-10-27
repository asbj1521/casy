import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import { findAnswer } from "@/hooks/useDateSearch";
import type { EventSettings } from "@/lib/eventSearch";
import { bigOnNewYearsDay } from "@/lib/newYear";
import { localDate, wallTime } from "@/lib/zone";

const TZ = "Europe/Copenhagen";
const AFTERNOON: EventSettings = { kind: "single", durationMinutes: 120, startHour: 15 };
const group = [{ profileId: "a", name: "a", busy: [] }];
const newYearsDay = new Date(wallTime(2027, 0, 1, 0, TZ)).toISOString();
const window = { start: newYearsDay, end: new Date(wallTime(2027, 1, 1, 0, TZ)).toISOString() };
const party: EventImpact = {
  v: 1,
  effects: ["alcohol"],
  runsLate: true,
  strain: "moderate",
  recoveryDays: 1,
  outdoors: false,
  daylight: false,
  confidence: "high",
  reason: "",
};
const big = (slot: { start: string; end: string }) => bigOnNewYearsDay(party, slot, AFTERNOON, TZ);
const dayOfAnswer = (found: ReturnType<typeof findAnswer>) =>
  localDate(Date.parse(found.slot!.start), TZ).day;

describe("findAnswer on 1 January (#166)", () => {
  it("steps past a big plan to the next date", () => {
    const step = { from: newYearsDay };
    expect(dayOfAnswer(findAnswer(group, AFTERNOON, step, window))).toBe(1);
    expect(dayOfAnswer(findAnswer(group, AFTERNOON, step, window, big))).toBe(2);
  });

  it("keeps it when the day was picked by hand", () => {
    const step = { from: newYearsDay, day: true };
    expect(dayOfAnswer(findAnswer(group, AFTERNOON, step, window, big))).toBe(1);
  });
});
