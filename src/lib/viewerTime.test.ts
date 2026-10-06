import { describe, expect, it } from "vitest";

import { yourTime } from "./viewerTime";
import { sameClock } from "./zone";

// Friday 9 October 2026, 18:00-20:00 Danish time (UTC+2 in October).
const dinner = { start: "2026-10-09T16:00:00.000Z", end: "2026-10-09T18:00:00.000Z" };

describe("sameClock", () => {
  it("treats zones with Danish time all year as the same clock", () => {
    expect(sameClock("Europe/Oslo", "Europe/Copenhagen", 2026)).toBe(true);
    expect(sameClock("Europe/Berlin", "Europe/Copenhagen", 2026)).toBe(true);
    expect(sameClock("Europe/Copenhagen", "Europe/Copenhagen", 2026)).toBe(true);
  });

  it("tells other clocks apart, a southern summer included", () => {
    expect(sameClock("Europe/London", "Europe/Copenhagen", 2026)).toBe(false);
    expect(sameClock("America/New_York", "Europe/Copenhagen", 2026)).toBe(false);
    expect(sameClock("Australia/Sydney", "Europe/Copenhagen", 2026)).toBe(false);
    expect(sameClock("UTC", "Europe/Copenhagen", 2026)).toBe(false);
  });
});

describe("yourTime", () => {
  it("adds nothing on a clock that is Danish time anyway", () => {
    expect(yourTime("single", dinner, "en", "Europe/Copenhagen")).toBeNull();
    expect(yourTime("single", dinner, "en", "Europe/Oslo")).toBeNull();
  });

  it("gives a meeting's times on the viewer's clock", () => {
    expect(yourTime("single", dinner, "en", "America/New_York")).toBe("12:00-14:00");
    expect(yourTime("single", dinner, "da", "Europe/London")).toBe("17:00-19:00");
  });

  it("puts the viewer's date in front when it is another day there", () => {
    expect(yourTime("single", dinner, "en", "Asia/Tokyo")).toBe("Sat 10 Oct 01:00-03:00");
  });

  it("gives a trip both ends with their dates", () => {
    const trip = { start: "2026-10-09T15:00:00.000Z", end: "2026-10-11T19:00:00.000Z" };
    expect(yourTime("trip", trip, "en", "America/New_York")).toBe(
      "Fri 9 Oct 11:00 to Sun 11 Oct 15:00",
    );
  });

  it("adds nothing to a holiday: whole Danish days have no times", () => {
    expect(yourTime("vacation", dinner, "en", "America/New_York")).toBeNull();
  });
});
