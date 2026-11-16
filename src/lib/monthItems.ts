/**
 * What My calendar's month view lays out (#104, #201), as whole blocks rather
 * than day by day: the Danish holidays inside the window, then every counted
 * block, named by its own title where the phone gave one, else by its
 * calendar's name. Pure, so the Swift home page (CasyCore `calendarItems`) can
 * be kept equal to it.
 */
import { holidaySegmentsByDay, type OverviewBlock } from "@/lib/calendarOverview";
import type { GridItem } from "@/lib/monthGrid";
import type { Lang } from "@/i18n/locale";

export function calendarItems(
  counted: OverviewBlock[],
  names: ReadonlyMap<string, string>,
  window: { from: number; to: number },
  timeZone: string,
  lang: Lang,
): GridItem[] {
  const holidays = holidaySegmentsByDay(new Date(window.from), new Date(window.to), timeZone);
  return [
    ...[...holidays.values()].flat().map((s) => ({
      calendarId: s.calendarId,
      start: s.start.getTime(),
      end: s.end.getTime(),
      label: s.holiday ? (lang === "da" ? s.holiday.name : s.holiday.englishName) : "",
    })),
    ...counted.map((b) => ({
      calendarId: b.calendarId,
      start: Date.parse(b.start),
      end: Date.parse(b.end),
      label: b.details?.title || (names.get(b.calendarId) ?? ""),
    })),
  ];
}
