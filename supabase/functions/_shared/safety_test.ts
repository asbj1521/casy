// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { HttpError } from "./http.ts";
import { MAX_REPORT_NOTE_LENGTH, readReport } from "./safety.ts";

Deno.test("a report names what it is about, and only that", () => {
  assertEquals(
    readReport({ kind: "event", groupId: "g", eventId: "e", memberId: "m", reason: "spam" }),
    { kind: "event", groupId: "g", eventId: "e", memberId: null, reason: "spam", note: null },
  );
  assertEquals(
    readReport({ kind: "member", groupId: "g", memberId: "m", reason: "other" }).memberId,
    "m",
  );
});

Deno.test("a report's note is trimmed and cut to length", () => {
  const long = "x".repeat(MAX_REPORT_NOTE_LENGTH + 50);
  const r = readReport({ kind: "group", groupId: "g", reason: "offensive", note: `  ${long}` });
  assertEquals(r.note?.length, MAX_REPORT_NOTE_LENGTH);
});

Deno.test("a report needs a known kind, a reason and what it names", () => {
  assertThrows(() => readReport({ kind: "post", groupId: "g", reason: "spam" }), HttpError);
  assertThrows(() => readReport({ kind: "group", groupId: "g", reason: "rude" }), HttpError);
  assertThrows(() => readReport({ kind: "event", groupId: "g", reason: "spam" }), HttpError);
});
