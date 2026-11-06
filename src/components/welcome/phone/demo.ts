/** The welcome animation's made-up people and month (#228). */

import type { GridItem } from "@/lib/monthGrid";
import { addDays, APP_TIME_ZONE, dayOfWeek, startOfMonth } from "@/lib/zone";

export const TZ = APP_TIME_ZONE;

/** You first, then the three friends whose calendars land on your phone, in Apple Calendar's colours. */
export const PEOPLE = [
  { id: "you", name: "", color: "0, 122, 255" },
  { id: "sara", name: "Sara", color: "52, 199, 89" },
  { id: "nova", name: "Nova", color: "175, 82, 222" },
  { id: "erik", name: "Erik", color: "255, 149, 0" },
];
export const FRIENDS = PEOPLE.slice(1);

export const colorOf = (id: string) => PEOPLE.find((p) => p.id === id)?.color ?? "";

/**
 * The example month: the first from next month whose 1st falls on a Thursday
 * or later, so the empty days before it have room for the name on the paper.
 */
export function demoMonth(now: number): number {
  for (let n = 1; n <= 12; n++) {
    const month = startOfMonth(now, TZ, n);
    if ((dayOfWeek(month, TZ) + 6) % 7 >= 3) return month;
  }
  return startOfMonth(now, TZ, 1);
}

/**
 * Who is busy when: every day has someone busy except three Fridays, which are
 * the only days that light up, so what the animation says is true of what it
 * shows. Each person's list keeps to the days in order, and later people's
 * items only ever go in rows under earlier ones' (layoutWeek), so a bar never
 * moves as the next calendar lands.
 */
export function demoPlan(month: number): { free: number[]; items: GridItem[][] } {
  const end = startOfMonth(month, TZ, 1);
  const days: number[] = [];
  for (let d = month; d < end; d = addDays(d, 1, TZ)) days.push(d);
  const free = days.filter((d) => dayOfWeek(d, TZ) === 5).slice(1, 4);
  const items: GridItem[][] = PEOPLE.map(() => []);
  days.forEach((d, i) => {
    if (free.includes(d)) return;
    const busy = new Set([i % 4]);
    if (i % 3 !== 2) busy.add((i + 2) % 4);
    if (i % 5 === 0) busy.add((i + 1) % 4);
    for (const who of busy) {
      items[who].push({
        calendarId: PEOPLE[who].id,
        start: d,
        end: addDays(d, 1, TZ),
        label: "",
      });
    }
  });
  return { free, items };
}
