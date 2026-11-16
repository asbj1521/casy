/** monthGrid.ts, the month layout and week numbers, and monthItems.ts, for Month.swift (#201). */
import { buildMonthLayout, isoWeekNumber, type OverviewBlock } from "@/lib/calendarOverview";
import { layoutWeek, type GridItem } from "@/lib/monthGrid";
import { calendarItems } from "@/lib/monthItems";
import { addDays, startOfDay, startOfMonth } from "@/lib/zone";

import { caseBook, type ParityCase } from "./cases";

const TZ = "Europe/Copenhagen";
const HOUR = 3_600_000;

export function monthCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261117);
  const flag = (odds: number) => random() < odds;

  // Months over several years, across both clock changes and year ends.
  for (let year = 2025; year <= 2028; year++) {
    for (let month = 0; month < 12; month++) {
      const layout = buildMonthLayout(year, month, TZ);
      add(
        "monthLayout",
        { year, month, timeZone: TZ },
        {
          weeks: layout.weeks.map((week) =>
            week.map((d) => ({
              date: d.date.getTime(),
              dayOfMonth: d.dayOfMonth,
              inMonth: d.inMonth,
            })),
          ),
          weekNumbers: layout.weekNumbers,
        },
      );
    }
  }
  for (let i = 0; i < 120; i++) {
    const ms = Date.UTC(2025, 0, 1) + int(0, 4 * 366) * 86_400_000 + int(0, 23) * HOUR;
    add("isoWeekNumber", { ms, timeZone: TZ }, isoWeekNumber(new Date(ms), TZ));
  }

  // Weeks with a crowd of items: chips, bars across days and weeks, pencilled dates.
  for (let i = 0; i < 150; i++) {
    const monday = addDays(startOfDay(Date.UTC(2026, 9, 5), TZ), int(-30, 30) * 7, TZ);
    const days = Array.from({ length: 7 }, (_, d) => addDays(monday, d, TZ));
    const weekEnd = addDays(monday, 7, TZ);
    const items: GridItem[] = Array.from({ length: int(0, 12) }, (_, n) => {
      const start = addDays(monday, int(-4, 8), TZ) + int(0, 23) * HOUR;
      const end = flag(0.3) ? start + int(1, 12) * 86_400_000 : start + int(1, 6) * HOUR;
      return {
        calendarId: pick(["a", "b", "c"]),
        start,
        end,
        label: `Item ${n}`,
        ...(flag(0.1) && { pencil: true }),
        ...(flag(0.1) && { pulse: true }),
      };
    });
    const lanes = pick([2, 3, 3, 3]);
    add("layoutWeek", { items, days, weekEnd, lanes }, layoutWeek(items, days, weekEnd, lanes));
  }

  // The month's own items: holidays in the window, and blocks named by title or calendar.
  for (let i = 0; i < 40; i++) {
    const from = startOfMonth(Date.UTC(2026, int(0, 23), 3), TZ);
    const to = startOfMonth(from, TZ, int(1, 14));
    const counted: OverviewBlock[] = Array.from({ length: int(0, 6) }, () => {
      const start = from + int(0, 200) * 86_400_000 + int(0, 23) * HOUR;
      return {
        calendarId: pick(["a", "b", "phone"]),
        start: new Date(start).toISOString(),
        end: new Date(start + int(1, 30) * HOUR).toISOString(),
        ...(flag(0.4) && {
          details: { title: pick(["Tandlæge", "", "Fodbold"]), location: "", notes: "" },
        }),
      };
    });
    const names = { a: "Arbejde", b: "Privat" };
    for (const lang of ["da", "en"] as const) {
      add(
        "calendarItems",
        { counted, names, from, to, timeZone: TZ, lang },
        calendarItems(counted, new Map(Object.entries(names)), { from, to }, TZ, lang),
      );
    }
  }
  return cases;
}
