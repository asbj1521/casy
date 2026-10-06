import { describe, expect, it } from "vitest";

import { layoutWeek, type GridItem } from "@/lib/monthGrid";
import { addDays, wallTime } from "@/lib/zone";

const TZ = "Europe/Copenhagen";
/** Monday 5 October 2026 to Sunday 11, and the Monday after. */
const MONDAY = wallTime(2026, 9, 5, 0, TZ);
const DAYS = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i, TZ));
const NEXT = addDays(MONDAY, 7, TZ);
const at = (day: number, hour: number) => wallTime(2026, 9, day, hour, TZ);
const item = (label: string, start: number, end: number, extra: Partial<GridItem> = {}) => ({
  calendarId: "c",
  label,
  start,
  end,
  ...extra,
});

describe("layoutWeek", () => {
  it("puts a day's events under it, one lane each", () => {
    const { placed } = layoutWeek(
      [
        item("Otto", at(5, 9), at(5, 10)),
        item("Corp", at(6, 12), at(6, 14)),
        item("KRING", at(8, 9), at(8, 10)),
        item("Study", at(8, 11), at(8, 12)),
      ],
      DAYS,
      NEXT,
      3,
    );
    expect(placed.map((p) => [p.item.label, p.from, p.to, p.lane])).toEqual([
      ["Otto", 0, 0, 0],
      ["Corp", 1, 1, 0],
      ["KRING", 3, 3, 0],
      ["Study", 3, 3, 1],
    ]);
  });

  it("draws something lasting days as one bar, cut at the week's edges", () => {
    const { placed } = layoutWeek([item("SO", at(1, 0), at(14, 0))], DAYS, NEXT, 3);
    expect(placed[0]).toMatchObject({
      from: 0,
      to: 6,
      continuesBefore: true,
      continuesAfter: true,
    });
  });

  it("gives bars the top lanes and counts what doesn't fit", () => {
    const { placed, hidden } = layoutWeek(
      [
        item("a", at(8, 9), at(8, 10)),
        item("b", at(8, 11), at(8, 12)),
        item("bar", at(7, 0), at(10, 0)),
      ],
      DAYS,
      NEXT,
      2,
    );
    expect(placed.map((p) => [p.item.label, p.lane])).toEqual([
      ["bar", 0],
      ["a", 1],
    ]);
    expect(hidden).toEqual([0, 0, 0, 1, 0, 0, 0]);
  });

  it("always shows the suggested date, before anything else that day", () => {
    const { placed } = layoutWeek(
      [item("work", at(7, 9), at(7, 17)), item("Frokost", at(7, 10), at(7, 14), { pencil: true })],
      DAYS,
      NEXT,
      1,
    );
    expect(placed.map((p) => p.item.label)).toEqual(["Frokost"]);
  });
});
