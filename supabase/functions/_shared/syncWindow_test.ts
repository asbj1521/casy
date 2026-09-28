// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";

import { syncWindow } from "./syncWindow.ts";

Deno.test("the window starts a week back and ends about a year ahead", () => {
  const { start, end } = syncWindow(new Date("2026-09-28T13:17:00.000Z"));
  assertEquals(start.toISOString(), "2026-09-21T13:17:00.000Z");
  assertEquals(end.toISOString(), "2027-09-23T13:17:00.000Z");
});
