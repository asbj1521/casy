/** Where a day lies on the phone's month, in the screen's pixels (#228). */

import type { Lang } from "@/i18n/locale";
import { LOCALE } from "@/i18n/lang";
import { buildMonthLayout } from "@/lib/calendarOverview";
import { weekRowPx } from "@/lib/monthGrid";
import { localDate } from "@/lib/zone";
import { TZ } from "./demo";
import { HEADER_PX, SCREEN } from "./geometry";

/** The middle of the day's number, as MonthSection draws it: a 40 px row under the week's line. */
export function dayCell(day: number, month: number, lang: Lang): { x: number; y: number } {
  const { year, month: m } = localDate(month, TZ);
  const { weeks } = buildMonthLayout(year, m, TZ, LOCALE[lang]);
  for (let w = 0; w < weeks.length; w++) {
    const c = weeks[w].findIndex((d) => d.date.getTime() === day);
    if (c >= 0) {
      return {
        x: ((c + 0.5) / 7) * SCREEN.width,
        y: HEADER_PX + w * weekRowPx(3) + 1 + 20,
      };
    }
  }
  throw new Error("That day is not in the month");
}

/** The list of dates, as Planlæg lays it over the month, under the toolbar. */
export const LIST = { top: 112, left: 16, height: 66, gap: 8 };
export const rowTop = (i: number) => LIST.top + i * (LIST.height + LIST.gap);

/**
 * How far the month must have scrolled for each date's circle to be level with
 * its row (DateList does the same, measured): never back up.
 */
export function listScrolls(days: number[], month: number, lang: Lang): number[] {
  let scroll = 0;
  return days.map((day, i) => {
    scroll = Math.max(scroll, dayCell(day, month, lang).y - (rowTop(i) + LIST.height / 2));
    return scroll;
  });
}
