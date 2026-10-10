import { describe, expect, it } from "vitest";

import type { OverviewBlock, OverviewCalendar } from "@/lib/calendarOverview";
import { phoneBusy, phoneWindow } from "@/lib/phoneBusy";
import { phoneCalendarIds, withPhoneEvents, type PhoneEventWithDetails } from "@/lib/phoneEvents";

const NOW = Date.parse("2026-10-09T10:00:00.000Z");
const WINDOW = phoneWindow(NOW);

const calendar = (id: string, connectionId: string, externalId?: string): OverviewCalendar => ({
  id,
  name: id,
  originalName: id,
  renamed: false,
  writable: false,
  purpose: null,
  priority: "normal",
  included: true,
  total: 0,
  provider: externalId ? "device" : "google",
  account: null,
  connectionId,
  externalId: externalId ?? null,
});

const event = (
  start: string,
  end: string,
  extra: Partial<PhoneEventWithDetails> = {},
): PhoneEventWithDetails => ({
  calendarId: "ek-home",
  allDay: false,
  free: false,
  cancelled: false,
  declined: false,
  start: Date.parse(start),
  end: Date.parse(end),
  title: "Statistik eksamen",
  location: "Aarhus Universitet",
  notes: "Husk lommeregner",
  ...extra,
});

const block = (calendarId: string, start: string, end: string): OverviewBlock => ({
  calendarId,
  start,
  end,
});

describe("phoneCalendarIds", () => {
  it("maps only this phone's calendars, by their EventKit id", () => {
    const ids = phoneCalendarIds(
      [
        calendar("s-home", "phone-1", "ek-home"),
        calendar("s-work", "phone-1", "ek-work"),
        calendar("s-other-phone", "phone-2", "ek-other"),
        calendar("s-google", "google-1"),
      ],
      "phone-1",
    );
    expect([...ids]).toEqual([
      ["ek-home", "s-home"],
      ["ek-work", "s-work"],
    ]);
  });
});

describe("withPhoneEvents", () => {
  const ids = new Map([["ek-home", "s-home"]]);

  it("replaces this phone's merged blocks with one block per event, details attached", () => {
    const blocks = [
      block("s-home", "2026-10-12T08:00:00.000Z", "2026-10-12T12:00:00.000Z"),
      block("s-google", "2026-10-12T13:00:00.000Z", "2026-10-12T14:00:00.000Z"),
    ];
    const events = [
      event("2026-10-12T08:00:00Z", "2026-10-12T10:00:00Z"),
      event("2026-10-12T10:00:00Z", "2026-10-12T12:00:00Z", {
        title: "  Frokost  ",
        location: undefined,
        notes: "",
      }),
    ];
    expect(withPhoneEvents(blocks, events, ids, WINDOW)).toEqual([
      block("s-google", "2026-10-12T13:00:00.000Z", "2026-10-12T14:00:00.000Z"),
      {
        ...block("s-home", "2026-10-12T08:00:00.000Z", "2026-10-12T10:00:00.000Z"),
        details: {
          title: "Statistik eksamen",
          location: "Aarhus Universitet",
          notes: "Husk lommeregner",
        },
      },
      {
        ...block("s-home", "2026-10-12T10:00:00.000Z", "2026-10-12T12:00:00.000Z"),
        details: { title: "Frokost", location: "", notes: "" },
      },
    ]);
  });

  it("draws only what counts as busy, as the server does", () => {
    const events = [
      event("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", { cancelled: true }),
      event("2026-10-12T09:00:00Z", "2026-10-12T10:00:00Z", { declined: true }),
      event("2026-10-12T10:00:00Z", "2026-10-12T11:00:00Z", { free: true }),
      // All-day events block even when marked free.
      event("", "", {
        allDay: true,
        free: true,
        start: undefined,
        end: undefined,
        startDay: "2026-10-14",
        endDay: "2026-10-15",
        title: "Bryllup",
      }),
    ];
    const drawn = withPhoneEvents([], events, ids, WINDOW);
    expect(drawn.map((b) => b.details?.title)).toEqual(["Bryllup"]);
    // A whole Danish day (summer time: midnight is 22:00 UTC the day before).
    expect(drawn[0]).toMatchObject({
      start: "2026-10-13T22:00:00.000Z",
      end: "2026-10-14T22:00:00.000Z",
    });
  });

  it("leaves events of calendars the server doesn't know, and everything outside the window", () => {
    const events = [
      event("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", { calendarId: "ek-new" }),
      event("2028-01-01T08:00:00Z", "2028-01-01T09:00:00Z"),
    ];
    expect(withPhoneEvents([], events, ids, WINDOW)).toEqual([]);
  });

  it("changes nothing without a phone calendar to match", () => {
    const blocks = [block("s-home", "2026-10-12T08:00:00.000Z", "2026-10-12T12:00:00.000Z")];
    expect(
      withPhoneEvents(
        blocks,
        [event("2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z")],
        new Map(),
        WINDOW,
      ),
    ).toBe(blocks);
  });
});

describe("what is sent to the server", () => {
  it("never carries an event's title, place or notes, even when read with them", () => {
    const read = {
      calendars: [
        { id: "ek-home", name: "Home", account: "iCloud", subscribed: false, writable: true },
      ],
      events: [event("2026-10-12T08:00:00Z", "2026-10-12T10:00:00Z")],
    };
    const sent = JSON.stringify(phoneBusy(read, WINDOW));
    expect(sent).toContain("2026-10-12T08:00:00.000Z");
    for (const secret of ["Statistik", "Aarhus", "lommeregner"]) {
      expect(sent).not.toContain(secret);
    }
  });
});
