import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { claimDue, SCHEDULED_BATCH, SCHEDULED_PARALLEL, syncWithin } from "./scheduledSync.ts";
import type { Db } from "./supabaseAdmin.ts";
import type { SyncOutcome, SyncTarget } from "./sync.ts";

const targets = (n: number): SyncTarget[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, provider: "apple" }));

const outcome = (t: SyncTarget, ok: boolean): SyncOutcome =>
  ok
    ? { connectionId: t.id, ok: true, busyBlocks: 1 }
    : { connectionId: t.id, ok: false, needsReconnect: false, message: "no" };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.test("claimDue asks for one batch of accounts 55 minutes old or more", async () => {
  let args: Record<string, unknown> = {};
  const db = {
    rpc: (_: string, a: Record<string, unknown>) => {
      args = a;
      return Promise.resolve({
        data: [{ connection_id: "c1", connection_provider: "google" }],
        error: null,
      });
    },
  } as unknown as Pick<Db, "rpc">;
  const found = await claimDue(db, new Date("2026-11-08T12:00:00Z"));
  assertEquals(found, [{ id: "c1", provider: "google" }]);
  assertEquals(args, {
    p_limit: SCHEDULED_BATCH,
    p_stale_before: "2026-11-08T11:05:00.000Z",
  });
});

Deno.test("claimDue passes a database error on", async () => {
  const db = {
    rpc: () => Promise.resolve({ data: null, error: new Error("down") }),
  } as unknown as Pick<Db, "rpc">;
  await assertRejects(() => claimDue(db), Error, "down");
});

Deno.test("syncWithin counts successes and failures", async () => {
  const result = await syncWithin(targets(4), (t) => Promise.resolve(outcome(t, t.id !== "c2")));
  assertEquals(result, { ok: 3, failed: 1, notStarted: [] });
});

Deno.test("syncWithin never runs more than its share at once", async () => {
  let running = 0;
  let most = 0;
  await syncWithin(targets(20), async (t) => {
    running++;
    most = Math.max(most, running);
    await wait(2);
    running--;
    return outcome(t, true);
  });
  assertEquals(most, SCHEDULED_PARALLEL);
});

Deno.test("syncWithin hands back what the budget left unstarted", async () => {
  const result = await syncWithin(
    targets(SCHEDULED_PARALLEL + 3),
    async (t) => {
      await wait(20);
      return outcome(t, true);
    },
    5,
  );
  assertEquals(result.ok, SCHEDULED_PARALLEL);
  assertEquals(result.notStarted.length, 3);
});
