import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import { refreshTargets, REFRESH_PARALLEL, runPooled, within } from "./groupRefresh.ts";
import type { SyncOutcome, SyncTarget } from "./sync.ts";

const targets = (n: number): SyncTarget[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, provider: "apple" }));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ok = (t: SyncTarget): SyncOutcome => ({ connectionId: t.id, ok: true, busyBlocks: 1 });

Deno.test("runs everything, never more than the limit at once", async () => {
  let running = 0;
  let most = 0;
  const done: number[] = [];
  await runPooled([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    running++;
    most = Math.max(most, running);
    await wait(5);
    done.push(n);
    running--;
  });
  assertEquals(done.sort(), [1, 2, 3, 4, 5, 6, 7]);
  assertEquals(most, 3);
});

Deno.test("within: true when the work finishes in time, false when it doesn't", async () => {
  assert(await within(wait(5), 200));
  assertFalse(await within(wait(200), 5));
});

Deno.test("nothing due: complete at once, nothing synced", async () => {
  const result = await refreshTargets([], () => Promise.reject(new Error("never called")));
  assertEquals([result.complete, result.synced], [true, false]);
});

Deno.test("syncs every account due, in parallel, and says it finished", async () => {
  const seen: string[] = [];
  let running = 0;
  let most = 0;
  const result = await refreshTargets(targets(20), async (t) => {
    running++;
    most = Math.max(most, running);
    await wait(5);
    seen.push(t.id);
    running--;
    return ok(t);
  });
  assertEquals([result.complete, result.synced], [true, true]);
  assertEquals(seen.length, 20);
  assertEquals(most, REFRESH_PARALLEL);
});

Deno.test("answers by the deadline, and the slow syncs still finish afterwards", async () => {
  const finished: string[] = [];
  const result = await refreshTargets(
    targets(2),
    async (t) => {
      await wait(t.id === "c0" ? 5 : 80);
      finished.push(t.id);
      return ok(t);
    },
    20,
  );
  assertEquals([result.complete, result.synced], [false, true]);
  assertEquals(finished, ["c0"]);
  await result.rest;
  assertEquals(finished, ["c0", "c1"]);
});

Deno.test("one sync throwing doesn't stop the others", async () => {
  const finished: string[] = [];
  const result = await refreshTargets(targets(3), async (t) => {
    if (t.id === "c1") throw new Error("provider down");
    finished.push(t.id);
    return ok(t);
  });
  assert(result.complete);
  assertEquals(finished.sort(), ["c0", "c2"]);
});
