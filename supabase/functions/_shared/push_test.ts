// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";

import { cleanToken, PUSH_KINDS, setPushKind } from "./push.ts";
import type { Db } from "./supabaseAdmin.ts";

Deno.test("a device token is lower case hex, or a 400", () => {
  assertEquals(cleanToken(`  ${"AB".repeat(32)} `), "ab".repeat(32));
  assertThrows(() => cleanToken("nope"));
  assertThrows(() => cleanToken(undefined));
  assertThrows(() => cleanToken("ab".repeat(2)));
});

/** The settings table, kept in memory for one person. */
function settingsDb(initialOff: string[]) {
  const saved: { off: string[] }[] = [];
  const db = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: { off: initialOff }, error: null }),
        upsert: (row: { off: string[] }) => {
          saved.push(row);
          return Promise.resolve({ error: null });
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ count: table === "push_devices" ? 1 : 0, error: null }),
      };
      return builder;
    },
  } as unknown as Db;
  return { db, saved };
}

Deno.test("a kind switched off is kept, once, and the others stay as they were", async () => {
  const { db, saved } = settingsDb(["deadline_near"]);
  assertEquals(await setPushKind(db, "p", "vote_invited", false), [
    "deadline_near",
    "vote_invited",
  ]);
  assertEquals(await setPushKind(db, "p", "deadline_near", false), ["deadline_near"]);
  assertEquals(saved.length, 2);
});

Deno.test("switching a kind on takes it off the list", async () => {
  const { db } = settingsDb(["vote_invited", "deadline_near"]);
  assertEquals(await setPushKind(db, "p", "vote_invited", true), ["deadline_near"]);
});

Deno.test("an unknown kind, or an answer that is not yes or no, is refused", async () => {
  const { db } = settingsDb([]);
  await assertRejects(() => setPushKind(db, "p", "everything", true));
  await assertRejects(() => setPushKind(db, "p", "vote_invited", "yes"));
});

Deno.test("the kinds are the ones the database's constraints allow", async () => {
  const migration = await Deno.readTextFile(
    new URL("../../migrations/20261030130000_push_notifications.sql", import.meta.url),
  );
  const settings = migration.match(/off <@ array\[([^\]]+)\]/)![1];
  const queue = migration.match(/check \(kind in\s*\(([^)]+)\)/)![1];
  for (const kind of PUSH_KINDS) {
    assert(settings.includes(`'${kind}'`), `${kind} is allowed in push_settings`);
    assert(queue.includes(`'${kind}'`), `${kind} is allowed in push_queue`);
  }
  assertEquals(settings.split(",").length, PUSH_KINDS.length);
  assertEquals(queue.split(",").length, PUSH_KINDS.length);
});
