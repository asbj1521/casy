import { describe, expect, it } from "vitest";

import { formatEventDate, formatHeadline, nameList } from "@/lib/format";

// Friday 25 September 2026, 18:00 to 21:00 in Copenhagen.
const EVENING = { start: "2026-09-25T16:00:00.000Z", end: "2026-09-25T19:00:00.000Z" };
// Friday 9 to Sunday 11 October: three whole days, `end` the midnight after.
const THREE_DAYS = { start: "2026-10-08T22:00:00.000Z", end: "2026-10-11T22:00:00.000Z" };

describe("formatHeadline", () => {
  const words = {
    scheduler: {
      timeRange: (a: string, b: string) => `${a} til ${b}`,
      tripTimes: (a: string, b: string) => `Afgang ${a}, hjem ${b}`,
    },
    common: { days: (n: number) => `${n} dage` },
  };

  it("puts a meeting's day big and its times under it", () => {
    const meeting = { kind: "single", durationMinutes: 180, startHour: 18 } as const;
    expect(formatHeadline(meeting, EVENING, "da", words)).toEqual({
      lines: ["Fredag 25. september"],
      time: "18:00 til 21:00",
    });
  });

  it("gives a holiday's two ends a line each, over how many days", () => {
    expect(formatHeadline({ kind: "vacation", days: 3 }, THREE_DAYS, "da", words)).toEqual({
      lines: ["Fredag 9. oktober til", "søndag 11. oktober"],
      time: "3 dage",
    });
  });

  it("keeps an English weekday capitalised mid-sentence", () => {
    expect(formatHeadline({ kind: "vacation", days: 3 }, THREE_DAYS, "en", words).lines).toEqual([
      "Friday 9 October to",
      "Sunday 11 October",
    ]);
  });
});

describe("formatEventDate", () => {
  it("reads a meeting as its day and times", () => {
    // October, whose short name is the same in every ICU version ("Sep" vs "Sept" isn't).
    const meeting = { start: "2026-10-09T16:00:00.000Z", end: "2026-10-09T19:00:00.000Z" };
    expect(formatEventDate("single", meeting, "en")).toBe("Fri 9 Oct · 18:00-21:00");
  });

  it("reads a holiday as its first and last day", () => {
    expect(formatEventDate("vacation", THREE_DAYS, "en")).toBe("Fri 9 Oct to Sun 11 Oct");
  });
});

describe("nameList", () => {
  it("reads naturally for one, two and many", () => {
    expect(nameList(["Emilie"], "en")).toBe("Emilie");
    expect(nameList(["Emilie", "Tessa"], "en")).toBe("Emilie and Tessa");
    expect(nameList(["Emilie", "Tessa", "Simon", "Nora"], "en")).toBe("Emilie, Tessa and 2 more");
  });

  it("joins names in Danish", () => {
    expect(nameList(["Emilie", "Tessa"], "da")).toBe("Emilie og Tessa");
    expect(nameList(["Emilie", "Tessa", "Simon", "Nora"], "da")).toBe("Emilie, Tessa og 2 andre");
  });
});
