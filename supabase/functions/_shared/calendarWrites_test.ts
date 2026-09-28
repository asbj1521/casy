// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";

import { nextStep } from "./calendarWrites.ts";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const scheduled = { status: "scheduled", end: "2026-10-02T19:00:00Z" };
const row = (wanted: boolean, added: boolean, source_id: string | null = "src") => ({ wanted, added, source_id });

Deno.test("a wanted, scheduled, upcoming event is added", () => {
  assertEquals(nextStep(row(true, false), scheduled, NOW), "put");
});

Deno.test("nothing to do once wanted and added agree", () => {
  assertEquals(nextStep(row(true, true), scheduled, NOW), "none");
  assertEquals(nextStep(row(false, false), scheduled, NOW), "none");
});

Deno.test("a cancelled, finished or missing event is never added", () => {
  assertEquals(nextStep(row(true, false), { ...scheduled, status: "cancelled" }, NOW), "forget");
  assertEquals(nextStep(row(true, false), { ...scheduled, status: "pending" }, NOW), "forget");
  assertEquals(nextStep(row(true, false), { ...scheduled, end: "2026-09-01T00:00:00Z" }, NOW), "forget");
  assertEquals(nextStep(row(true, false), null, NOW), "forget");
});

Deno.test("an added event that is no longer wanted is removed", () => {
  assertEquals(nextStep(row(false, true), { ...scheduled, status: "cancelled" }, NOW), "delete");
  // Even if the event row is gone entirely.
  assertEquals(nextStep(row(false, true), null, NOW), "delete");
});

Deno.test("without its calendar, nothing can be added or removed", () => {
  assertEquals(nextStep(row(true, false, null), scheduled, NOW), "forget");
  assertEquals(nextStep(row(false, true, null), scheduled, NOW), "forget");
});
