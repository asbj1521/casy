import { describe, expect, it } from "vitest";

import { calendarColors, segmentByDay, type OverviewData } from "@/lib/calendarOverview";
import {
  CASY_CALENDAR_ID,
  CASY_RGB,
  entryBlocks,
  entryBusy,
  entryWhen,
  type StoredEntry,
} from "@/lib/casyEntries";
import { findMeetingSlot } from "@/lib/availability";
import { busyFromCalendars } from "@/lib/realCalendar";
import { APP_TIME_ZONE } from "@/lib/zone";

/** Monday 12 to Monday 19 October 2026, whole Danish days (summer time). */
const AWAY: StoredEntry = {
  id: "a",
  kind: "away",
  label: "Rejse",
  start: "2026-10-11T22:00:00.000Z",
  end: "2026-10-19T22:00:00.000Z",
  allDay: true,
};
/** Thursday 22 October, 18:00 to 22:00. */
const COURSE: StoredEntry = {
  id: "b",
  kind: "busy",
  label: "Kursus",
  start: "2026-10-22T16:00:00.000Z",
  end: "2026-10-22T20:00:00.000Z",
  allDay: false,
};

describe("entryBlocks", () => {
  it("draws entries as blocks of the built-in Casy calendar, named by their labels", () => {
    expect(entryBlocks([AWAY, COURSE])).toEqual([
      {
        calendarId: CASY_CALENDAR_ID,
        start: AWAY.start,
        end: AWAY.end,
        details: { title: "Rejse", location: "", notes: "" },
      },
      {
        calendarId: CASY_CALENDAR_ID,
        start: COURSE.start,
        end: COURSE.end,
        details: { title: "Kursus", location: "", notes: "" },
      },
    ]);
  });

  it("splits a stretch away into the days of My calendar, one per day", () => {
    const byDay = segmentByDay(
      entryBlocks([AWAY]),
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-11-01T00:00:00Z"),
      APP_TIME_ZONE,
    );
    expect([...byDay.keys()]).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
    expect(byDay.get("2026-10-15")![0]).toMatchObject({
      allDay: true,
      calendarId: CASY_CALENDAR_ID,
    });
  });

  it("has its own colour, so it never takes a category's or the palette's", () => {
    expect(calendarColors([]).get(CASY_CALENDAR_ID)).toBe(CASY_RGB);
  });
});

describe("entryBusy", () => {
  it("makes a stretch away never skippable and busy time an ordinary block", () => {
    expect(entryBusy([AWAY, COURSE])).toEqual([
      { start: AWAY.start, end: AWAY.end, title: "Rejse", priority: "never" },
      { start: COURSE.start, end: COURSE.end, title: "Kursus" },
    ]);
  });
});

describe("busyFromCalendars with entries", () => {
  const data: OverviewData = {
    calendars: [],
    blocks: [],
    truncated: false,
    entries: [AWAY, COURSE],
  };

  it("counts what you told Casy as busy time of your own, with no calendar connected", () => {
    expect(busyFromCalendars(data)).toEqual(entryBusy([AWAY, COURSE]));
  });

  it("works for data fetched before entries existed", () => {
    expect(busyFromCalendars({ calendars: [], blocks: [], truncated: false })).toEqual([]);
  });

  it("keeps a meeting out of the week away but finds the first day after", () => {
    const { slot } = findMeetingSlot({
      participants: [{ profileId: "me", name: "Mia", busy: busyFromCalendars(data) }],
      durationMinutes: 60,
      searchStart: "2026-10-11T22:00:00.000Z",
      searchEnd: "2026-10-30T00:00:00.000Z",
      timeZone: APP_TIME_ZONE,
      constraints: { earliestHour: 17, latestHour: 18, allowedDays: [1, 2, 3, 4, 5] },
    });
    // Not 12 to 19 October; Tuesday the 20th at 17:00 is the first evening free.
    expect(slot?.start).toBe("2026-10-20T15:00:00.000Z");
  });
});

describe("entryWhen", () => {
  it("writes whole days as a span, or as the one day", () => {
    expect(entryWhen(AWAY, "en")).toBe("Mon 12 Oct to Mon 19 Oct");
    expect(entryWhen({ ...AWAY, end: "2026-10-12T22:00:00.000Z" }, "en")).toBe("Mon 12 Oct");
  });

  it("writes hours on a day, and both ends across midnight, in Danish time", () => {
    expect(entryWhen(COURSE, "da")).toBe("tors. 22. okt. · 18:00-22:00");
    expect(
      entryWhen(
        { ...COURSE, start: "2026-10-22T20:00:00.000Z", end: "2026-10-22T23:00:00.000Z" },
        "en",
      ),
    ).toBe("Thu 22 Oct 22:00 to Fri 23 Oct 01:00");
  });
});
