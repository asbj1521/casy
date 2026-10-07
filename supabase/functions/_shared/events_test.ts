// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import {
  cleanEventDetail,
  cleanEventTitle,
  currentDate,
  isEventSettings,
  isPeopleSettings,
  MAX_CANDIDATES,
  MAX_PLACE_LENGTH,
  parseCandidateDates,
  parseEventDate,
  VOTE_ANSWER_MS,
  voteAnswerMs,
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

Deno.test("a place or note is optional, tidied, and capped", () => {
  assertEquals(cleanEventDetail("  Hos Sara ", MAX_PLACE_LENGTH), "Hos Sara");
  assertEquals(cleanEventDetail(undefined, MAX_PLACE_LENGTH), null);
  assertEquals(cleanEventDetail(null, MAX_PLACE_LENGTH), null);
  assertEquals(cleanEventDetail("   ", MAX_PLACE_LENGTH), null);
  assertEquals(cleanEventDetail("x".repeat(150), MAX_PLACE_LENGTH)?.length, MAX_PLACE_LENGTH);
  // Something no page of ours sends.
  assertEquals(cleanEventDetail(42, MAX_PLACE_LENGTH), undefined);
});

Deno.test("a vote waits 1 to 7 whole days, 3 when not chosen", () => {
  const day = 24 * 60 * 60 * 1000;
  assertEquals(voteAnswerMs(undefined), VOTE_ANSWER_MS);
  assertEquals(voteAnswerMs(1), day);
  assertEquals(voteAnswerMs(7), 7 * day);
  for (const bad of [0, 8, 2.5, "3", null]) assertEquals(voteAnswerMs(bad), null);
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

Deno.test("people settings: members, optional among them, at least N for meetings only", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const c = "33333333-3333-4333-8333-333333333333";
  assertEquals(isPeopleSettings({ members: [a, b], optional: [] }, "single"), true);
  assertEquals(isPeopleSettings({ members: [a, b, c], optional: [c], atLeast: 1 }, "single"), true);
  assertEquals(
    isPeopleSettings({ members: [a, b, c], optional: [c], atLeast: 3 }, "single"),
    false,
  );
  assertEquals(isPeopleSettings({ members: [a, b], optional: [], atLeast: 1 }, "trip"), false);
  assertEquals(isPeopleSettings({ members: [a, a], optional: [] }, "single"), false);
  assertEquals(isPeopleSettings({ members: [a], optional: [b] }, "single"), false);
  assertEquals(isPeopleSettings({ members: ["not-a-uuid"], optional: [] }, "single"), false);
  assertEquals(isPeopleSettings({ members: [], optional: [] }, "single"), false);
  // In the settings as a whole.
  const single = { kind: "single", durationMinutes: 60, startHour: 18 };
  assertEquals(isEventSettings({ ...single, people: { members: [a], optional: [] } }), true);
  assertEquals(isEventSettings({ ...single, people: { members: [] } }), false);
});
