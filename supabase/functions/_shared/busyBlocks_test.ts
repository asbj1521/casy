import { assertEquals } from "jsr:@std/assert@1";

import { withoutRepeats } from "./busyBlocks.ts";

Deno.test("an event in two calendars is sent once", () => {
  const block = { start: "2026-10-07T17:00:00+00:00", end: "2026-10-07T19:00:00+00:00" };
  assertEquals(withoutRepeats([block, { ...block }]), [block]);
});

Deno.test("the same times written differently are still one block", () => {
  assertEquals(
    withoutRepeats([
      { start: "2026-10-07T17:00:00+00:00", end: "2026-10-07T19:00:00+00:00" },
      { start: "2026-10-07T17:00:00.000Z", end: "2026-10-07T19:00:00.000Z" },
    ]).length,
    1,
  );
});

Deno.test("different tags, or blocks that only overlap, are all kept, in order", () => {
  const a = { start: "2026-10-07T08:00:00Z", end: "2026-10-07T16:00:00Z", category: "work" };
  const b = { start: "2026-10-07T08:00:00Z", end: "2026-10-07T16:00:00Z" };
  const c = { start: "2026-10-07T12:00:00Z", end: "2026-10-07T18:00:00Z" };
  const d = { start: "2026-10-07T08:00:00Z", end: "2026-10-07T16:00:00Z", priority: "never" };
  assertEquals(withoutRepeats([a, b, c, d]), [a, b, c, d]);
});
