import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import { impactOn, profileInput } from "@/lib/eventImpact";
import type { EventSettings } from "@/lib/eventSearch";
import { APP_TIME_ZONE } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

const profile = (over: Partial<EventImpact> = {}): EventImpact => ({
  v: 1,
  effects: [],
  runsLate: false,
  strain: "moderate",
  recoveryDays: 0,
  outdoors: false,
  daylight: false,
  confidence: "high",
  reason: "",
  ...over,
});

const meeting: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };
const trip: EventSettings = {
  kind: "trip",
  shape: { anchorDow: 5, spanDays: 3, startHour: 16, endHour: 18 },
};

/** A date in October 2026 (summer time, UTC+2) by its Danish clock. */
const dk = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 9, day, hour - 2, minute)).toISOString();

describe("profileInput", () => {
  it("describes a meeting by its start and length, any time as -1", () => {
    expect(profileInput(meeting, " Fredagsbar ", " Mikkeller ", "")).toEqual({
      title: "Fredagsbar",
      place: "Mikkeller",
      note: "",
      kind: "meeting",
      startMinute: 18 * 60,
      minutes: 180,
      days: 1,
    });
    expect(
      profileInput({ ...meeting, startHour: 19.5, anyTime: true }, "Kaffe", "", "").startMinute,
    ).toBe(-1);
    expect(profileInput({ ...meeting, startHour: 19.5 }, "Kaffe", "", "").startMinute).toBe(1170);
  });

  it("describes a trip or a holiday by its days", () => {
    expect(profileInput(trip, "Berlin", "", "")).toMatchObject({ kind: "trip", days: 3 });
    expect(profileInput({ kind: "vacation", days: 7 }, "Ski", "", "")).toMatchObject({
      kind: "holiday",
      days: 7,
      startMinute: -1,
      minutes: 0,
    });
  });
});

describe("impactOn", () => {
  it("claims nothing without a profile", () => {
    expect(impactOn(null, { start: dk(9, 18), end: dk(9, 21) }, meeting, TZ)).toBeNull();
  });

  it("passes the profile on for the date", () => {
    const impact = impactOn(
      profile({ effects: ["exercise", "alcohol"], strain: "heavy", recoveryDays: 1 }),
      { start: dk(9, 18), end: dk(9, 20) },
      meeting,
      TZ,
    );
    // In the vocabulary's order, whatever order they came in.
    expect(impact).toMatchObject({
      effects: ["alcohol", "exercise"],
      strain: "heavy",
      recoveryDays: 1,
      start: Date.parse(dk(9, 18)),
      end: Date.parse(dk(9, 20)),
    });
  });

  it("makes a meeting ending at 23:00 or later (or past midnight) a late night", () => {
    const late = (start: string, end: string) =>
      impactOn(profile(), { start, end }, meeting, TZ)!.effects.includes("lateNight");
    expect(late(dk(9, 20), dk(9, 22, 59))).toBe(false);
    expect(late(dk(9, 20), dk(9, 23))).toBe(true);
    expect(late(dk(9, 22), dk(10, 1))).toBe(true);
  });

  it("makes one that usually runs late a late night when planned to end at 21:00 or later", () => {
    const late = (end: string) =>
      impactOn(profile({ runsLate: true }), { start: dk(9, 17), end }, meeting, TZ)!.effects;
    expect(late(dk(9, 20, 30))).toEqual([]);
    expect(late(dk(9, 21))).toEqual(["lateNight"]);
  });

  it("leaves a trip's nights to the profile", () => {
    const date = { start: dk(9, 16), end: dk(11, 18) };
    expect(impactOn(profile({ runsLate: true }), date, trip, TZ)!.effects).toEqual([]);
    expect(impactOn(profile({ effects: ["travel"] }), date, trip, TZ)!.effects).toEqual(["travel"]);
  });
});
