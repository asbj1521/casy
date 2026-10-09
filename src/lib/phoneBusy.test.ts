import { describe, expect, it } from "vitest";

import { busySpan, phoneBusy, phoneWindow, type PhoneEvent } from "@/lib/phoneBusy";

const NOW = Date.parse("2026-10-09T10:00:00.000Z");
const WINDOW = phoneWindow(NOW);

const timed = (start: string, end: string, extra: Partial<PhoneEvent> = {}): PhoneEvent => ({
  calendarId: "home",
  allDay: false,
  free: false,
  cancelled: false,
  declined: false,
  start: Date.parse(start),
  end: Date.parse(end),
  ...extra,
});

const allDay = (startDay: string, endDay: string, extra: Partial<PhoneEvent> = {}): PhoneEvent => ({
  calendarId: "home",
  allDay: true,
  free: true,
  cancelled: false,
  declined: false,
  startDay,
  endDay,
  ...extra,
});

const home = { id: "home", name: "Home", account: "iCloud", subscribed: false, writable: true };

describe("busySpan", () => {
  it("keeps a timed event's instants", () => {
    expect(busySpan(timed("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z"))).toEqual({
      start: Date.parse("2026-10-12T08:00:00Z"),
      end: Date.parse("2026-10-12T09:00:00Z"),
    });
  });

  it("drops cancelled, declined and free timed events", () => {
    const s = "2026-10-12T08:00:00Z";
    const e = "2026-10-12T09:00:00Z";
    expect(busySpan(timed(s, e, { cancelled: true }))).toBeNull();
    expect(busySpan(timed(s, e, { declined: true }))).toBeNull();
    expect(busySpan(timed(s, e, { free: true }))).toBeNull();
  });

  it("blocks all-day events even marked free, as whole Danish days", () => {
    // Copenhagen is UTC+2 until 25 October: local midnight is 22:00 UTC the day before.
    expect(busySpan(allDay("2026-10-12", "2026-10-14"))).toEqual({
      start: Date.parse("2026-10-11T22:00:00Z"),
      end: Date.parse("2026-10-13T22:00:00Z"),
    });
  });

  it("follows daylight saving: the day it ends is 25 hours", () => {
    expect(busySpan(allDay("2026-10-25", "2026-10-26"))).toEqual({
      start: Date.parse("2026-10-24T22:00:00Z"),
      end: Date.parse("2026-10-25T23:00:00Z"),
    });
  });

  it("drops events without a usable time", () => {
    expect(busySpan(allDay("2026-10-12", "2026-10-12"))).toBeNull();
    expect(busySpan(allDay("12/10/2026", "2026-10-13"))).toBeNull();
    expect(busySpan(timed("2026-10-12T09:00:00Z", "2026-10-12T08:00:00Z"))).toBeNull();
    expect(
      busySpan({ ...timed("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z"), end: undefined }),
    ).toBeNull();
  });
});

describe("phoneBusy", () => {
  it("merges each calendar's overlapping and touching blocks", () => {
    const [cal] = phoneBusy(
      {
        calendars: [home],
        events: [
          timed("2026-10-12T10:00:00Z", "2026-10-12T11:00:00Z"),
          timed("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z"),
          timed("2026-10-12T09:00:00Z", "2026-10-12T09:30:00Z"),
        ],
      },
      WINDOW,
    );
    expect(cal.blocks).toEqual([
      { start: "2026-10-12T08:00:00.000Z", end: "2026-10-12T09:30:00.000Z" },
      { start: "2026-10-12T10:00:00.000Z", end: "2026-10-12T11:00:00.000Z" },
    ]);
  });

  it("keeps calendars apart, and lists a calendar with no events", () => {
    const result = phoneBusy(
      {
        calendars: [
          home,
          { id: "work", name: "Work", account: "Exchange", subscribed: false, writable: true },
        ],
        events: [timed("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", { calendarId: "work" })],
      },
      WINDOW,
    );
    expect(result.map((c) => [c.id, c.blocks.length])).toEqual([
      ["home", 0],
      ["work", 1],
    ]);
  });

  it("leaves out events wholly outside the window", () => {
    const [cal] = phoneBusy(
      { calendars: [home], events: [timed("2026-09-01T08:00:00Z", "2026-09-01T09:00:00Z")] },
      WINDOW,
    );
    expect(cal.blocks).toEqual([]);
  });

  it("names calendars that share a name by their account", () => {
    const names = phoneBusy(
      {
        calendars: [
          { id: "a", name: "Calendar", account: "iCloud", subscribed: false, writable: true },
          { id: "b", name: "Calendar", account: "me@gmail.com", subscribed: false, writable: true },
          home,
        ],
        events: [],
      },
      WINDOW,
    ).map((c) => c.name);
    expect(names).toEqual(["Calendar (iCloud)", "Calendar (me@gmail.com)", "Home"]);
  });

  it("hides a subscription holding only whole days (holidays), not a timetable", () => {
    const result = phoneBusy(
      {
        calendars: [
          {
            id: "holidays",
            name: "Danish holidays",
            account: "Other",
            subscribed: true,
            writable: false,
          },
          { id: "uni", name: "Timetable", account: "Other", subscribed: true, writable: false },
          { id: "empty", name: "Empty feed", account: "Other", subscribed: true, writable: false },
        ],
        events: [
          allDay("2026-12-24", "2026-12-25", { calendarId: "holidays" }),
          allDay("2026-12-31", "2027-01-01", { calendarId: "uni" }),
          timed("2026-10-12T08:00:00Z", "2026-10-12T10:00:00Z", { calendarId: "uni" }),
        ],
      },
      WINDOW,
    );
    expect(result.map((c) => [c.id, c.hidden])).toEqual([
      ["holidays", true],
      ["uni", false],
      ["empty", false],
    ]);
  });
});
