import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import type { EventSettings } from "@/lib/eventSearch";
import { bigOnNewYearsDay, onNewYearsDay } from "@/lib/newYear";
import { wallTime } from "@/lib/zone";

const TZ = "Europe/Copenhagen";
const iso = (month: number, day: number, hour: number, year = 2027) =>
  new Date(wallTime(year, month, day, hour, TZ)).toISOString();
const slot = (fromHour: number, toHour: number) => ({
  start: iso(0, 1, fromHour),
  end: iso(0, 1, toHour),
});
const MEETING: EventSettings = { kind: "single", durationMinutes: 120, startHour: 15 };
const profile = (extra: Partial<EventImpact> = {}): EventImpact => ({
  v: 1,
  effects: [],
  runsLate: false,
  strain: "light",
  recoveryDays: 0,
  outdoors: false,
  daylight: false,
  confidence: "high",
  reason: "",
  ...extra,
});

describe("onNewYearsDay", () => {
  it("is 1 January in Danish time, from midnight to midnight", () => {
    expect(onNewYearsDay(iso(0, 1, 0), TZ)).toBe(true);
    expect(onNewYearsDay(iso(0, 1, 23), TZ)).toBe(true);
    expect(onNewYearsDay(iso(11, 31, 23, 2026), TZ)).toBe(false);
    expect(onNewYearsDay(iso(0, 2, 0), TZ)).toBe(false);
  });
});

describe("bigOnNewYearsDay", () => {
  it("is big when the profile says alcohol, a late night or heavy strain", () => {
    expect(bigOnNewYearsDay(profile({ effects: ["alcohol"] }), slot(15, 17), MEETING, TZ)).toBe(
      true,
    );
    expect(bigOnNewYearsDay(profile({ effects: ["lateNight"] }), slot(15, 17), MEETING, TZ)).toBe(
      true,
    );
    expect(bigOnNewYearsDay(profile({ strain: "heavy" }), slot(15, 17), MEETING, TZ)).toBe(true);
  });

  it("is small for a quiet afternoon, with or without a profile", () => {
    expect(bigOnNewYearsDay(profile({ effects: ["exercise"] }), slot(15, 17), MEETING, TZ)).toBe(
      false,
    );
    expect(bigOnNewYearsDay(null, slot(15, 17), MEETING, TZ)).toBe(false);
  });

  it("without a profile, goes by the timing: ending at 23:00 or later is big", () => {
    expect(bigOnNewYearsDay(null, slot(20, 23), MEETING, TZ)).toBe(true);
    expect(bigOnNewYearsDay(null, slot(19, 22), MEETING, TZ)).toBe(false);
  });

  it("is never big on another day", () => {
    const eve = { start: iso(0, 2, 19), end: iso(0, 2, 23) };
    expect(bigOnNewYearsDay(profile({ effects: ["alcohol"] }), eve, MEETING, TZ)).toBe(false);
  });
});
