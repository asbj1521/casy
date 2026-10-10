import { describe, expect, it } from "vitest";

import type { CalendarConnectionStatus, CalendarSourceStatus } from "@/api/calendars";
import { phoneSourceIds, sampleTitles, SAMPLE_TITLES, uncategorised } from "@/lib/autoCategorize";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

const source = (id: string, extra: Partial<CalendarSourceStatus> = {}): CalendarSourceStatus => ({
  id,
  display_name: id,
  custom_name: null,
  purpose: null,
  purpose_source: null,
  priority: "normal",
  writable: false,
  external_id: null,
  ...extra,
});

const connection = (
  id: string,
  sources: CalendarSourceStatus[],
  status: CalendarConnectionStatus["status"] = "connected",
): CalendarConnectionStatus => ({
  id,
  provider: "device",
  status,
  account_label: "iPhone",
  error_message: null,
  created_at: "2026-10-01T10:00:00.000Z",
  last_synced_at: null,
  last_sync_attempt_at: null,
  sync_error: null,
  needs_reconnect: false,
  calendar_sources: sources,
  busyCount: 0,
});

describe("uncategorised", () => {
  it("lists only calendars nobody has set a category for, in connected accounts", () => {
    expect(
      uncategorised([
        connection("a", [
          source("untouched"),
          source("picked", { purpose: "work", purpose_source: "user" }),
          source("cleared by hand", { purpose_source: "user" }),
          source("guessed", { purpose: "school", purpose_source: "ai" }),
          source("ai unsure", { purpose_source: "ai" }),
          // Carried over from an older connection without its marker: still set.
          source("carried", { purpose: "personal" }),
        ]),
        connection("b", [source("still connecting")], "pending"),
      ]),
    ).toEqual(["untouched"]);
  });
});

describe("phoneSourceIds", () => {
  it("maps this phone's calendars by their EventKit id", () => {
    const ids = phoneSourceIds(
      [
        connection("phone", [source("s1", { external_id: "ek1" }), source("s2")]),
        connection("other", [source("s3", { external_id: "ek3" })]),
      ],
      "phone",
    );
    expect([...ids]).toEqual([["ek1", "s1"]]);
  });
});

describe("sampleTitles", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const event = (
    title: string,
    start: string,
    extra: Partial<PhoneEventWithDetails> = {},
  ): PhoneEventWithDetails => ({
    calendarId: "ek-uni",
    allDay: false,
    free: false,
    cancelled: false,
    declined: false,
    start: Date.parse(start),
    end: Date.parse(start) + 3_600_000,
    title,
    ...extra,
  });
  const ids = new Map([
    ["ek-uni", "s-uni"],
    ["ek-done", "s-done"],
  ]);

  it("takes distinct titles nearest now, only for the calendars wanted", () => {
    const titles = sampleTitles(
      [
        event("Statistik forelæsning", "2026-12-01T08:00:00Z"),
        event("Statistik forelæsning", "2026-10-12T08:00:00Z"),
        event("Eksamen", "2026-10-11T08:00:00Z"),
        event("Aflyst", "2026-10-10T13:00:00Z", { cancelled: true }),
        event("  ", "2026-10-10T14:00:00Z"),
        event("Heldagsseminar", "", {
          allDay: true,
          start: undefined,
          end: undefined,
          startDay: "2026-10-20",
          endDay: "2026-10-21",
        }),
        event("Already sorted", "2026-10-10T12:00:00Z", { calendarId: "ek-done" }),
        event("Not on the server", "2026-10-10T12:00:00Z", { calendarId: "ek-new" }),
      ],
      ids,
      new Set(["s-uni"]),
      now,
    );
    expect(titles).toEqual({
      "s-uni": ["Eksamen", "Statistik forelæsning", "Heldagsseminar"],
    });
  });

  it("stops at SAMPLE_TITLES per calendar", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      event(`Vagt ${i}`, new Date(now + i * 3_600_000).toISOString()),
    );
    expect(sampleTitles(many, ids, new Set(["s-uni"]), now)["s-uni"]).toHaveLength(SAMPLE_TITLES);
  });
});
