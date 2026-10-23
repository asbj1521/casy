import { describe, expect, it } from "vitest";

import { da } from "@/i18n/da";
import { en } from "@/i18n/en";
import { isCasyTripEntry, TRIP_NOTES } from "@/lib/casyTripEntry";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

const entry = (notes: string): PhoneEventWithDetails => ({
  calendarId: "ek-home",
  allDay: true,
  free: false,
  cancelled: false,
  declined: false,
  startDay: "2026-12-21",
  endDay: "2026-12-28",
  title: "Rejse til Oslo",
  location: "",
  notes,
});

describe("isCasyTripEntry", () => {
  it("knows the note in both languages, as the language files write it", () => {
    expect(TRIP_NOTES).toEqual([da.trips.calendarNote, en.trips.calendarNote]);
    expect(isCasyTripEntry(entry("Lagt ind af Casy."))).toBe(true);
    expect(isCasyTripEntry(entry(" Added by Casy.\n"))).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(isCasyTripEntry(entry(""))).toBe(false);
    expect(isCasyTripEntry(entry("Fly SK1456, lagt ind af Casy."))).toBe(false);
    expect(isCasyTripEntry({ ...entry(""), notes: undefined })).toBe(false);
  });
});
