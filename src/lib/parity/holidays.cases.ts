/** danishHolidays.ts, holidayBlocks.ts and newYear.ts's date check, for Holidays.swift. */
import { danishHolidays, easterSunday } from "@/lib/danishHolidays";
import { holidayBlocks, withHolidayBlocks } from "@/lib/holidayBlocks";
import { onNewYearsDay } from "@/lib/newYear";
import { APP_TIME_ZONE } from "@/lib/zone";

import { caseBook, type ParityCase } from "./cases";

export function holidaysCases(): ParityCase[] {
  const { cases, add, int } = caseBook(20261110);
  for (let year = 1900; year <= 2100; year++) add("easterSunday", { year }, easterSunday(year));
  // 2022: Pinsedag on Grundlovsdag. To 2023: Store bededag.
  for (let year = 2015; year <= 2040; year++) {
    for (const timeZone of [APP_TIME_ZONE, "America/New_York"]) {
      const output = danishHolidays(year, timeZone).map((h) => ({ ...h, date: h.date.getTime() }));
      add("danishHolidays", { year, timeZone }, output);
    }
    add(
      "holidayBlocks",
      { years: [year], timeZone: APP_TIME_ZONE },
      holidayBlocks([year], APP_TIME_ZONE),
    );
  }
  const people = [
    { profileId: "a", name: "A", busy: [] },
    {
      profileId: "b",
      name: "B",
      busy: [{ start: "2026-06-20T14:00:00.000Z", end: "2026-06-20T15:00:00.000Z" }],
    },
  ];
  for (const now of [Date.UTC(2026, 5, 1), Date.UTC(2026, 11, 31, 23, 30), Date.UTC(2027, 0, 1)]) {
    add(
      "withHolidayBlocks",
      { participants: people, timeZone: APP_TIME_ZONE, now },
      withHolidayBlocks(people, APP_TIME_ZONE, now),
    );
  }
  for (let i = 0; i < 60; i++) {
    const year = int(2025, 2030);
    const iso = new Date(Date.UTC(year, 11, 31, int(20, 23), int(0, 59))).toISOString();
    add("onNewYearsDay", { iso, timeZone: APP_TIME_ZONE }, onNewYearsDay(iso, APP_TIME_ZONE));
    const next = new Date(Date.UTC(year, 0, 1, int(0, 23))).toISOString();
    add("onNewYearsDay", { iso: next, timeZone: "UTC" }, onNewYearsDay(next, "UTC"));
  }
  return cases;
}
