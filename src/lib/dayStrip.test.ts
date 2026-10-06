import { describe, expect, it } from "vitest";

import type { DaySegment } from "@/lib/calendarOverview";
import { placeBlocks, placeSpan } from "@/lib/dayStrip";
import { wallTime } from "@/lib/zone";

const TZ = "Europe/Copenhagen";
const at = (day: number, hour: number) => wallTime(2026, 9, day, hour, TZ);

function seg(day: number, from: number, to: number, allDay = false): DaySegment {
  return {
    calendarId: "c",
    start: new Date(at(day, from)),
    end: new Date(at(day, to)),
    allDay,
    continuesBefore: false,
    continuesAfter: false,
  };
}

describe("placeSpan", () => {
  it("places 18:00 to 21:00 on the whole day", () => {
    const { top, height } = placeSpan(at(14, 18), at(14, 21), at(14, 0), TZ);
    expect(top).toBeCloseTo(18 / 24);
    expect(height).toBeCloseTo(3 / 24);
  });

  it("counts the extra hour on the day the clocks go back", () => {
    // 25 October 2026 has 25 hours, so 18:00 is 19 of them in: within a few
    // pixels of the 18:00 line, which is drawn as on any other day.
    const { top } = placeSpan(at(25, 18), at(25, 19), at(25, 0), TZ);
    expect(top).toBeCloseTo(19 / 25);
  });

  it("clips what runs into the next day", () => {
    const { top, height } = placeSpan(at(14, 22), at(15, 2), at(14, 0), TZ);
    expect(top).toBeCloseTo(22 / 24);
    expect(height).toBeCloseTo(2 / 24);
  });
});

describe("placeBlocks", () => {
  const sides = (placed: ReturnType<typeof placeBlocks>) =>
    placed.map((p) => [+p.left.toFixed(2), +p.width.toFixed(2)]);

  it("gives a block the whole width when nothing overlaps it, and leaves out all-day ones", () => {
    const placed = placeBlocks(
      [seg(14, 9, 12), seg(14, 13, 14), seg(14, 0, 24, true)],
      at(14, 0),
      TZ,
    );
    expect(sides(placed)).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("puts blocks starting together side by side", () => {
    const placed = placeBlocks([seg(14, 9, 12), seg(14, 9, 10)], at(14, 0), TZ, 0, 0.5 / 24);
    expect(sides(placed)).toEqual([
      [0, 0.5],
      [0.5, 0.5],
    ]);
  });

  it("indents a block starting during another, over it", () => {
    // Work 14 to 18, a class 15 to 15:30: the class sits indented on top.
    const placed = placeBlocks([seg(14, 14, 18), seg(14, 15, 15.5)], at(14, 0), TZ, 0, 0.5 / 24);
    expect(sides(placed)).toEqual([
      [0, 1],
      [0.3, 0.7],
    ]);
  });

  it("draws a short block tall enough for its name", () => {
    const min = 1 / 24; // an hour
    const [short] = placeBlocks([seg(14, 9, 9.25)], at(14, 0), TZ, min);
    expect(short.height).toBeCloseTo(min);
  });
});
