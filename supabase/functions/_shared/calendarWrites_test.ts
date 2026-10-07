// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";

import { type AddedEntry, missingEntries, nextStep } from "./calendarWrites.ts";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const scheduled = { status: "scheduled", end: "2026-10-02T19:00:00Z" };
const row = (wanted: boolean, added: boolean, source_id: string | null = "src") => ({
  wanted,
  added,
  source_id,
});

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
  assertEquals(
    nextStep(row(true, false), { ...scheduled, end: "2026-09-01T00:00:00Z" }, NOW),
    "forget",
  );
  assertEquals(nextStep(row(true, false), null, NOW), "forget");
});

Deno.test("an added event that is no longer wanted is removed", () => {
  assertEquals(nextStep(row(false, true), { ...scheduled, status: "cancelled" }, NOW), "delete");
  // Even if the event row is gone entirely.
  assertEquals(nextStep(row(false, true), null, NOW), "delete");
});

Deno.test("an added entry whose details changed is replaced, while there is one to replace", () => {
  const refreshed = { ...row(true, true), refresh: true };
  assertEquals(nextStep(refreshed, scheduled, NOW), "replace");
  // Over, or no calendar any more: only the flag goes.
  assertEquals(nextStep(refreshed, { ...scheduled, end: "2026-09-01T00:00:00Z" }, NOW), "settle");
  assertEquals(nextStep({ ...refreshed, source_id: null }, scheduled, NOW), "settle");
  // A cancel still takes it out, refresh or not.
  assertEquals(
    nextStep({ ...row(false, true), refresh: true }, { ...scheduled, status: "cancelled" }, NOW),
    "delete",
  );
});

Deno.test("without its calendar, nothing can be added or removed", () => {
  assertEquals(nextStep(row(true, false, null), scheduled, NOW), "forget");
  assertEquals(nextStep(row(false, true, null), scheduled, NOW), "forget");
});

/* ---- Noticing an entry deleted by hand ---- */

const READ_AT = new Date("2026-09-28T12:00:00Z");
const WINDOW_START = READ_AT;
const WINDOW_END = new Date("2027-09-23T12:00:00Z");
const entry = (id: string, over: Partial<AddedEntry> = {}): AddedEntry => ({
  proposal_id: id,
  updated_at: "2026-09-27T10:00:00Z",
  status: "scheduled",
  start: "2026-10-02T16:00:00Z",
  end: "2026-10-02T19:00:00Z",
  ...over,
});
const missing = (entries: AddedEntry[], seen: string[]) =>
  missingEntries(entries, new Set(seen), READ_AT, WINDOW_START, WINDOW_END);

Deno.test("an added entry whose UID is nowhere in the account is missing", () => {
  assertEquals(missing([entry("a"), entry("b")], ["a@casy.app", "someone-elses-event"]), ["b"]);
});

Deno.test("an entry added while the account was being read is not judged", () => {
  assertEquals(missing([entry("a", { updated_at: "2026-09-28T12:00:05Z" })], []), []);
});

Deno.test("only events the read could have seen are judged", () => {
  // Over already, or further ahead than the sync reads.
  assertEquals(
    missing([entry("a", { start: "2026-09-01T10:00:00Z", end: "2026-09-01T11:00:00Z" })], []),
    [],
  );
  assertEquals(
    missing([entry("a", { start: "2027-10-01T10:00:00Z", end: "2027-10-01T11:00:00Z" })], []),
    [],
  );
  // Under way right now: still in the read.
  assertEquals(
    missing([entry("a", { start: "2026-09-28T11:00:00Z", end: "2026-09-28T13:00:00Z" })], []),
    ["a"],
  );
});

Deno.test("cancelled events, and events with no date, are left to the cancel path", () => {
  assertEquals(missing([entry("a", { status: "cancelled" })], []), []);
  assertEquals(missing([entry("a", { start: null, end: null })], []), []);
});
