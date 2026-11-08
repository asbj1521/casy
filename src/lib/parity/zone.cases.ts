/**
 * The cases zone.ts and CasyCore's Zone.swift must answer alike
 * (docs/native-ios-plan.md): instants across every daylight-saving change for
 * years, zones with half-hour offsets and clocks that move by half an hour,
 * and the odd inputs the engine really passes (day 32, hour 26).
 */
import {
  addDays,
  atHour,
  dayOf,
  dayOfWeek,
  localDate,
  offsetAt,
  sameClock,
  startOfDay,
  startOfMonth,
  wallTime,
} from "@/lib/zone";

import { seededRandom } from "./random";

export interface ParityCase {
  name: string;
  input: { fn: string; args: Record<string, unknown> };
  output: unknown;
}

const ZONES = [
  "Europe/Copenhagen",
  "UTC",
  "Europe/London",
  "Europe/Oslo",
  "America/New_York",
  "Australia/Sydney",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Asia/Kolkata",
  "Asia/Kathmandu",
];
const FIRST_MS = Date.UTC(2024, 0, 1);
const LAST_MS = Date.UTC(2031, 0, 1);
const HOUR = 3_600_000;

export function zoneCases(): ParityCase[] {
  const random = seededRandom(20261108);
  const int = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));
  const pick = <T>(items: T[]): T => items[int(0, items.length - 1)];
  const instant = () => int(FIRST_MS, LAST_MS);
  const hours = () => pick([0, 2, 2.5, 3, 18.5, 23.75, 24, 26, 0.1 + 0.2, 1 / 3, 7.125]);

  const cases: ParityCase[] = [];
  const seen = new Set<string>();
  const add = (fn: string, args: Record<string, unknown>, output: unknown) => {
    const name = `${fn} ${JSON.stringify(args)}`;
    if (seen.has(name)) return;
    seen.add(name);
    cases.push({ name, input: { fn, args }, output });
  };

  const everyQuestionAbout = (ms: number, timeZone: string) => {
    add("offsetAt", { ms, timeZone }, offsetAt(ms, timeZone));
    add("localDate", { ms, timeZone }, localDate(ms, timeZone));
    add("startOfDay", { ms, timeZone }, startOfDay(ms, timeZone));
    add("dayOfWeek", { ms, timeZone }, dayOfWeek(ms, timeZone));
  };

  // Around each European and American change, and the southern ones in between.
  for (let year = 2025; year <= 2030; year++) {
    for (const timeZone of ZONES) {
      for (const month of [2, 3, 9, 10]) {
        const day = int(1, 28);
        everyQuestionAbout(Date.UTC(year, month, day, int(0, 3)), timeZone);
      }
      // The European change itself, on the last Sundays of March and October.
      for (const month of [2, 9]) {
        const lastDay = Date.UTC(year, month + 1, 0);
        const sunday = lastDay - new Date(lastDay).getUTCDay() * 24 * HOUR;
        for (const hour of [0, 0.75, 1, 1.25, 2]) {
          everyQuestionAbout(sunday + hour * HOUR, timeZone);
        }
        const d = new Date(sunday);
        for (const local of [1.5, 2, 2.5, 3]) {
          const args = { year, month, day: d.getUTCDate(), hours: local, timeZone };
          add("wallTime", args, wallTime(year, month, d.getUTCDate(), local, timeZone));
        }
      }
    }
  }

  for (let i = 0; i < 400; i++) {
    const timeZone = pick(ZONES);
    const ms = instant();
    switch (i % 5) {
      case 0: {
        const args = {
          year: int(2024, 2030),
          month: int(-3, 14),
          day: int(-5, 40),
          hours: hours(),
          timeZone,
        };
        add("wallTime", args, wallTime(args.year, args.month, args.day, args.hours, timeZone));
        break;
      }
      case 1: {
        const n = int(-400, 400);
        add("addDays", { ms, n, timeZone }, addDays(ms, n, timeZone));
        break;
      }
      case 2: {
        const h = hours();
        add("atHour", { ms, hours: h, timeZone }, atHour(ms, h, timeZone));
        break;
      }
      case 3: {
        const n = int(-30, 30);
        add("startOfMonth", { ms, n, timeZone }, startOfMonth(ms, timeZone, n));
        break;
      }
      default: {
        const iso = new Date(ms).toISOString();
        add("dayOf", { iso, timeZone }, dayOf(iso, timeZone));
        const micro = `${iso.slice(0, -1)}456+00:00`;
        add("dayOf", { iso: micro, timeZone }, dayOf(micro, timeZone));
      }
    }
  }

  for (const iso of [
    "2026-06-20T14:00:00+02:00",
    "2026-06-20T14:00-05:30",
    "2026-01-01T00:00:00Z",
  ]) {
    add("dayOf", { iso, timeZone: "Europe/Copenhagen" }, dayOf(iso, "Europe/Copenhagen"));
  }
  for (const [a, b] of [
    ["Europe/Copenhagen", "Europe/Oslo"],
    ["Europe/Copenhagen", "Europe/London"],
    ["Europe/Copenhagen", "Europe/Copenhagen"],
    ["Europe/Copenhagen", "Australia/Sydney"],
    ["UTC", "Asia/Kolkata"],
  ]) {
    add("sameClock", { a, b, year: 2026 }, sameClock(a, b, 2026));
  }
  // Before 1970, where division has to round down, not towards zero.
  for (const ms of [-1, -86_400_000, -86_400_001, -900_001]) {
    add("localDate", { ms, timeZone: "UTC" }, localDate(ms, "UTC"));
    add("startOfDay", { ms, timeZone: "UTC" }, startOfDay(ms, "UTC"));
  }
  return cases;
}
