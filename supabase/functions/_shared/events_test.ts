// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import {
  cleanEventTitle,
  currentDate,
  isEventSettings,
  MAX_CANDIDATES,
  parseCandidateDates,
  parseEventDate,
} from "./events.ts";

Deno.test("settings in each known shape are accepted", () => {
  assertEquals(isEventSettings({ kind: "single", durationMinutes: 180, startHour: 18 }), true);
  assertEquals(
    isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, allowedDays: [5, 6, 0] }),
    true,
  );
  assertEquals(
    isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, anyTime: true }),
    true,
  );
  assertEquals(
    isEventSettings({
      kind: "trip",
      shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 },
    }),
    true,
  );
  assertEquals(isEventSettings({ kind: "vacation", days: 7 }), true);
});

Deno.test("malformed settings are refused", () => {
  assertEquals(isEventSettings(null), false);
  assertEquals(isEventSettings([]), false);
  assertEquals(isEventSettings({ kind: "party" }), false);
  assertEquals(isEventSettings({ kind: "single", durationMinutes: 90 }), false);
  assertEquals(isEventSettings({ kind: "single", durationMinutes: 90, startHour: 24 }), false);
  assertEquals(
    isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, allowedDays: [7] }),
    false,
  );
  assertEquals(
    isEventSettings({ kind: "single", durationMinutes: 90, startHour: 12, anyTime: "yes" }),
    false,
  );
  assertEquals(isEventSettings({ kind: "trip", shape: { anchorDow: 5 } }), false);
  assertEquals(isEventSettings({ kind: "vacation", days: 31 }), false);
});

Deno.test("a sensible future date is kept, normalised to ISO", () => {
  const now = Date.parse("2026-09-22T10:00:00.000Z");
  assertEquals(
    parseEventDate({ start: "2026-09-25T16:00:00Z", end: "2026-09-25T19:00:00Z" }, now),
    { start: "2026-09-25T16:00:00.000Z", end: "2026-09-25T19:00:00.000Z" },
  );
});

Deno.test("dates that are over, backwards, too long or too far out are refused", () => {
  const now = Date.parse("2026-09-22T10:00:00.000Z");
  const date = (start: string, end: string) => parseEventDate({ start, end }, now);
  assertEquals(date("2026-09-20T16:00:00Z", "2026-09-20T19:00:00Z"), null); // over
  assertEquals(date("2026-09-25T19:00:00Z", "2026-09-25T16:00:00Z"), null); // backwards
  assertEquals(date("2026-10-01T00:00:00Z", "2026-11-15T00:00:00Z"), null); // 45 days
  assertEquals(date("2028-01-01T00:00:00Z", "2028-01-02T00:00:00Z"), null); // too far
  assertEquals(parseEventDate({ start: "soon", end: "later" }, now), null);
  assertEquals(parseEventDate(null, now), null);
});

Deno.test("titles are tidied and never left blank", () => {
  assertEquals(cleanEventTitle("  Weekend trip  "), "Weekend trip");
  assertEquals(cleanEventTitle("Two\nlines"), "Twolines");
  assertEquals(cleanEventTitle("   "), null);
  assertEquals(cleanEventTitle(3), null);
});

Deno.test("the date on offer is the newest one nobody declined", () => {
  const date = (id: string, createdAt: string, declined = false) => ({
    id,
    created_at: createdAt,
    declined_at: declined ? createdAt : null,
  });
  const dates = [
    date("first", "2026-09-01T10:00:00Z", true),
    date("second", "2026-09-02T10:00:00Z"),
    date("third", "2026-09-03T10:00:00Z", true),
  ];
  assertEquals(currentDate(dates)?.id, "second");
  assertEquals(currentDate(dates.slice(0, 1)), null);
  assertEquals(currentDate([]), null);
});

Deno.test("a vote's date is the chosen one, and none until it is chosen", () => {
  const date = (id: string, chosen = false) => ({
    id,
    created_at: "2026-09-01T10:00:00Z",
    declined_at: null,
    chosen_at: chosen ? "2026-09-02T10:00:00Z" : null,
  });
  assertEquals(currentDate([date("a"), date("b")], "vote"), null);
  assertEquals(currentDate([date("a"), date("b", true)], "vote")?.id, "b");
  // A chosen date wins even where the mode isn't known (calendarWrites).
  assertEquals(currentDate([date("a"), date("b", true)])?.id, "b");
});

Deno.test("a vote's dates are kept sorted, and refused when any is off", () => {
  const now = Date.parse("2026-09-22T10:00:00.000Z");
  const on = (day: number) => ({
    start: `2026-10-${day}T16:00:00.000Z`,
    end: `2026-10-${day}T19:00:00.000Z`,
  });
  assertEquals(parseCandidateDates([on(14), on(12)], now), [on(12), on(14)]);
  assertEquals(parseCandidateDates([], now), null);
  assertEquals(parseCandidateDates([on(12), on(12)], now), null); // the same date twice
  assertEquals(parseCandidateDates([on(12), { start: "soon", end: "later" }], now), null);
  assertEquals(parseCandidateDates("2026-10-12", now), null);
  const tooMany = Array.from({ length: MAX_CANDIDATES + 1 }, (_, i) => on(10 + i));
  assertEquals(parseCandidateDates(tooMany, now), null);
});
