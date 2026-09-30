// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import { allDayInstant, type GraphEvent, outlookEventBlocks } from "./outlook.ts";

const event = (showAs: string, isAllDay: boolean, isCancelled = false): GraphEvent => ({
  start: { dateTime: "2026-10-05T00:00:00.0000000" },
  end: { dateTime: "2026-10-06T00:00:00.0000000" },
  showAs,
  isAllDay,
  isCancelled,
});

Deno.test("an all-day event shown as free blocks (Outlook's default)", () => {
  assertEquals(outlookEventBlocks(event("free", true)), true);
  assertEquals(outlookEventBlocks(event("oof", true)), true);
});

Deno.test("a timed event shown as free doesn't block", () => {
  assertEquals(outlookEventBlocks(event("free", false)), false);
  assertEquals(outlookEventBlocks(event("busy", false)), true);
});

Deno.test("birthdays, holidays and working elsewhere never block, all-day or not", () => {
  for (const showAs of ["unknown", "workingElsewhere", ""]) {
    assertEquals(outlookEventBlocks(event(showAs, true)), false, showAs);
  }
});

Deno.test("a cancelled all-day event doesn't block", () => {
  assertEquals(outlookEventBlocks(event("busy", true, true)), false);
});

Deno.test("an all-day date becomes Danish midnight, however Graph expressed it", () => {
  // Midnight UTC (what the UTC Prefer header gives)...
  assertEquals(allDayInstant("2026-10-05T00:00:00.000Z"), "2026-10-04T22:00:00.000Z");
  // ...or a Danish midnight already converted to UTC: the same day either way.
  assertEquals(allDayInstant("2026-10-04T22:00:00.000Z"), "2026-10-04T22:00:00.000Z");
  assertEquals(allDayInstant("2026-12-14T00:00:00.000Z"), "2026-12-13T23:00:00.000Z");
});
