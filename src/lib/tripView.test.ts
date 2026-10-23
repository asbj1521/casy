import { describe, expect, it } from "vitest";

import { detectTrips, NO_ANSWERS, type Leg } from "@/lib/trips";
import { cityName, isPending, markOn, revealDay, tripMarks } from "@/lib/tripView";
import { APP_TIME_ZONE, wallTime } from "@/lib/zone";

const at = (month: number, day: number, hour = 0) =>
  wallTime(2026, month - 1, day, hour, APP_TIME_ZONE);
const NOW = at(10, 1, 9);

let n = 0;
const leg = (from: string, to: string, start: number, end: number, names?: Leg["names"]): Leg => ({
  id: `l${++n}`,
  mode: "flight",
  from,
  to,
  start,
  end,
  count: 1,
  names,
});

const home = { ...NO_ANSWERS, home: "copenhagen" };

describe("tripMarks", () => {
  it("names a trip by where it stayed, past the connections, as the AI wrote it", () => {
    const legs = [
      leg("copenhagen", "amsterdam", at(10, 12, 8), at(10, 12, 9), {
        from: "copenhagen",
        to: "Amsterdam",
      }),
      leg("amsterdam", "new york", at(10, 12, 11), at(10, 12, 19), {
        from: "Amsterdam",
        to: "New York",
      }),
      leg("new york", "copenhagen", at(10, 19, 20), at(10, 20, 9), {
        from: "New York",
        to: "Copenhagen",
      }),
    ];
    const [mark] = tripMarks(detectTrips(legs, home, NOW), "en");
    expect(mark).toMatchObject({ kind: "trip", city: "New York", start: legs[0].start });
    expect(isPending(mark)).toBe(true);
  });

  it("names a question by the far end, title-cased when no leg wrote it out", () => {
    const out = leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11));
    // Beyond MAX_TRIP_DAYS, so the two are asked about apart.
    const back = leg("bergen", "copenhagen", at(12, 30, 10), at(12, 30, 11));
    const marks = tripMarks(detectTrips([out, back], home, NOW), "en");
    expect(marks.map((m) => [m.kind, m.city])).toEqual([
      ["question", "Oslo"],
      ["question", "Bergen"],
    ]);
  });

  it("marks an accepted trip as no longer waiting", () => {
    const legs = [
      leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11)),
      leg("oslo", "copenhagen", at(10, 19, 10), at(10, 19, 11)),
    ];
    const [mark] = tripMarks(detectTrips(legs, { ...home, accepted: [legs[0].id] }, NOW), "en");
    expect(isPending(mark)).toBe(false);
  });
});

describe("cityName", () => {
  const legs = [
    leg("copenhagen", "rome", at(10, 5, 8), at(10, 5, 11), { from: "Copenhagen", to: "Rome" }),
  ];
  it("says a city the Danish way on a Danish page, and as written otherwise", () => {
    expect(cityName("copenhagen", legs, "da")).toBe("København");
    expect(cityName("rome", legs, "da")).toBe("Rom");
    expect(cityName("copenhagen", legs, "en")).toBe("Copenhagen");
    expect(cityName("oslo", legs, "da")).toBe("Oslo");
  });
});

describe("markOn and revealDay", () => {
  const accepted = [
    leg("copenhagen", "rome", at(10, 5, 8), at(10, 5, 11)),
    leg("rome", "copenhagen", at(10, 8, 8), at(10, 8, 11)),
  ];
  const pending = [
    leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11)),
    leg("oslo", "copenhagen", at(10, 19, 18), at(10, 19, 19)),
  ];
  const marks = tripMarks(
    detectTrips([...accepted, ...pending], { ...home, accepted: [accepted[0].id] }, NOW),
    "en",
  );

  it("finds the mark on every day it covers, and none outside", () => {
    expect(markOn(marks, at(10, 12))?.id).toBe(pending[0].id);
    expect(markOn(marks, at(10, 15))?.id).toBe(pending[0].id);
    expect(markOn(marks, at(10, 19))?.id).toBe(pending[0].id);
    expect(markOn(marks, at(10, 20))).toBeUndefined();
    expect(markOn(marks, at(10, 6))?.id).toBe(accepted[0].id);
  });

  it("glides to the first one still waiting, past accepted ones", () => {
    expect(revealDay(marks)).toBe(at(10, 12));
    expect(revealDay(marks.filter((m) => !isPending(m)))).toBeNull();
  });
});
