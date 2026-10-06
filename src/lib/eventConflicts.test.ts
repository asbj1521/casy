import { describe, expect, it } from "vitest";

import { cantMake } from "@/lib/eventConflicts";
import type { EventSettings } from "@/lib/eventSearch";
import type { BusyInterval, Participant } from "@/types";

const TZ = "Europe/Copenhagen";
const person = (profileId: string, busy: BusyInterval[] = []): Participant => ({
  profileId,
  name: profileId,
  busy,
});
const block = (start: string, end: string, extra: Partial<BusyInterval> = {}): BusyInterval => ({
  start,
  end,
  ...extra,
});
// Long before any of these dates, so none of them has passed.
const NOW = Date.parse("2026-09-01T00:00:00.000Z");

describe("cantMake: a meeting", () => {
  // Friday 9 October 2026, 18:00-20:00 Danish time (UTC+2).
  const dinner: EventSettings = { kind: "single", startHour: 18, durationMinutes: 120 };
  const date = { start: "2026-10-09T16:00:00.000Z", end: "2026-10-09T18:00:00.000Z" };

  it("names nobody while everyone is still free", () => {
    const people = [
      person("anna"),
      person("bo", [block("2026-10-09T08:00:00Z", "2026-10-09T15:00:00Z")]),
    ];
    expect(cantMake(people, dinner, date, TZ, NOW)).toEqual([]);
  });

  it("names whoever now has something then", () => {
    const people = [
      person("anna"),
      person("bo", [block("2026-10-09T16:30:00Z", "2026-10-09T17:00:00Z")]),
      person("cy", [block("2026-10-09T17:59:00Z", "2026-10-09T19:00:00Z")]),
    ];
    expect(cantMake(people, dinner, date, TZ, NOW)).toEqual(["bo", "cy"]);
  });

  it("doesn't count something on a calendar marked skippable", () => {
    const people = [
      person("bo", [block("2026-10-09T16:30:00Z", "2026-10-09T17:00:00Z", { priority: "skip" })]),
    ];
    expect(cantMake(people, dinner, date, TZ, NOW)).toEqual([]);
  });

  it("doesn't count something that only touches the edges", () => {
    const people = [
      person("bo", [
        block("2026-10-09T14:00:00Z", "2026-10-09T16:00:00Z"),
        block("2026-10-09T18:00:00Z", "2026-10-09T19:00:00Z"),
      ]),
    ];
    expect(cantMake(people, dinner, date, TZ, NOW)).toEqual([]);
  });

  it("reads a stored date written with +00:00 the same as Z", () => {
    const stored = { start: "2026-10-09T16:00:00+00:00", end: "2026-10-09T18:00:00+00:00" };
    expect(cantMake([person("anna")], dinner, stored, TZ, NOW)).toEqual([]);
  });

  it("names nobody once the date has passed", () => {
    const people = [person("bo", [block("2026-10-09T16:30:00Z", "2026-10-09T17:00:00Z")])];
    expect(cantMake(people, dinner, date, TZ, Date.parse("2026-10-10T00:00:00Z"))).toEqual([]);
  });

  it("works the same for a meeting at any time of day", () => {
    const anyTime: EventSettings = { ...dinner, anyTime: true };
    const morning = { start: "2026-10-09T08:00:00.000Z", end: "2026-10-09T10:00:00.000Z" };
    expect(cantMake([person("anna")], anyTime, morning, TZ, NOW)).toEqual([]);
    const taken = [person("bo", [block("2026-10-09T09:00:00Z", "2026-10-09T09:30:00Z")])];
    expect(cantMake(taken, anyTime, morning, TZ, NOW)).toEqual(["bo"]);
  });
});

describe("cantMake: whole days", () => {
  // Monday 12 to Friday 16 October 2026, as Danish midnights.
  const holiday: EventSettings = { kind: "vacation", days: 5 };
  const week = { start: "2026-10-11T22:00:00.000Z", end: "2026-10-16T22:00:00.000Z" };

  it("names nobody who is free", () => {
    expect(cantMake([person("anna")], holiday, week, TZ, NOW)).toEqual([]);
  });

  it("names someone now away for a whole day of it", () => {
    const away = person("bo", [block("2026-10-13T22:00:00Z", "2026-10-14T22:00:00Z")]);
    expect(cantMake([person("anna"), away], holiday, week, TZ, NOW)).toEqual(["bo"]);
  });

  it("doesn't count work, which a holiday always asked time off from", () => {
    const working = person("bo", [
      block("2026-10-13T06:00:00Z", "2026-10-13T14:00:00Z", { category: "work" }),
    ]);
    expect(cantMake([working], holiday, week, TZ, NOW)).toEqual([]);
  });

  it("doesn't count a dinner during a trip", () => {
    // Friday 17:00 to Sunday 21:00, 9 to 11 October.
    const weekend: EventSettings = {
      kind: "trip",
      shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 },
    };
    const trip = { start: "2026-10-09T15:00:00.000Z", end: "2026-10-11T19:00:00.000Z" };
    // Free all weekend: the check must not trip over its own window.
    expect(cantMake([person("anna")], weekend, trip, TZ, NOW)).toEqual([]);
    const dinnerOut = person("bo", [block("2026-10-10T17:00:00Z", "2026-10-10T19:00:00Z")]);
    expect(cantMake([dinnerOut], weekend, trip, TZ, NOW)).toEqual([]);
    const away = person("cy", [block("2026-10-09T22:00:00Z", "2026-10-10T22:00:00Z")]);
    expect(cantMake([away], weekend, trip, TZ, NOW)).toEqual(["cy"]);
  });
});
