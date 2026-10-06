import { assertEquals } from "jsr:@std/assert@1";

import { healthOf } from "./health.ts";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

Deno.test("healthy: synced within the hour, nothing failing", () => {
  assertEquals(healthOf({ connected: 10, failing: 0, newestSync: ago(20) }, NOW), { ok: true });
});

Deno.test("stale: nothing synced for over three hours, whatever the reason", () => {
  assertEquals(healthOf({ connected: 10, failing: 0, newestSync: ago(181) }, NOW), {
    ok: false,
    reason: "stale",
  });
  assertEquals(healthOf({ connected: 2, failing: 0, newestSync: null }, NOW), {
    ok: false,
    reason: "stale",
  });
});

Deno.test("failing: more than 30% of accounts, once there are enough to tell", () => {
  assertEquals(healthOf({ connected: 10, failing: 4, newestSync: ago(10) }, NOW), {
    ok: false,
    reason: "failing",
  });
  assertEquals(healthOf({ connected: 10, failing: 3, newestSync: ago(10) }, NOW), { ok: true });
  // With three accounts, one bad credential is the owner's problem, not an outage.
  assertEquals(healthOf({ connected: 3, failing: 2, newestSync: ago(10) }, NOW), { ok: true });
});

Deno.test("no accounts at all is nothing to worry about", () => {
  assertEquals(healthOf({ connected: 0, failing: 0, newestSync: null }, NOW), { ok: true });
});
