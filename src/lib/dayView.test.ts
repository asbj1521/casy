import { describe, expect, it } from "vitest";

import { dayParam, parseDayParam, segmentOnDay } from "@/lib/dayView";
import { APP_TIME_ZONE, atHour, wallTime } from "@/lib/zone";

const TZ = APP_TIME_ZONE;
const at = (d: number, h: number) => wallTime(2026, 9, d, h, TZ);

describe("the day in the address", () => {
  it("writes and reads a day in Danish time", () => {
    const day = at(29, 0);
    expect(dayParam(day)).toBe("2026-10-29");
    expect(parseDayParam("2026-10-29")).toBe(day);
    // The day the clocks go back is 25 hours long; still its own midnight.
    expect(parseDayParam("2026-10-25")).toBe(atHour(at(25, 12), 0, TZ));
  });

  it("reads nothing from what isn't a real day", () => {
    for (const bad of [null, "", "2026-10", "29-10-2026", "2026-02-31", "2026-13-01", "x"]) {
      expect(parseDayParam(bad)).toBeNull();
    }
  });
});

describe("Casy's events as a day's blocks", () => {
  it("puts a timed event on its day, and nowhere else", () => {
    const seg = segmentOnDay(at(29, 18), at(29, 21), at(29, 0), "casy");
    expect(seg).toMatchObject({ calendarId: "casy", allDay: false, continuesBefore: false });
    expect(seg!.start.getTime()).toBe(at(29, 18));
    expect(segmentOnDay(at(29, 18), at(29, 21), at(30, 0), "casy")).toBeNull();
    // Ending at midnight is not on the next day.
    expect(segmentOnDay(at(29, 18), at(30, 0), at(30, 0), "casy")).toBeNull();
  });

  it("clips one running past midnight, and a trip's middle day is a whole day", () => {
    const late = segmentOnDay(at(29, 22), at(30, 2), at(30, 0), "casy")!;
    expect(late.start.getTime()).toBe(at(30, 0));
    expect(late).toMatchObject({ allDay: false, continuesBefore: true, continuesAfter: false });
    const middle = segmentOnDay(at(28, 0), at(31, 0), at(29, 0), "casy")!;
    expect(middle).toMatchObject({ allDay: true, continuesBefore: true, continuesAfter: true });
  });
});
