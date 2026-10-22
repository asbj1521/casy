import { assertEquals } from "jsr:@std/assert@1";

import { aiConsented, aiContentAllowed, CONSENT_VERSION, setAiConsent } from "./aiAccess.ts";
import type { Db } from "./supabaseAdmin.ts";

const ADMIN = "11111111-1111-4111-8111-111111111111";

interface World {
  /** ai_access: whether the person has AI, and whether they are a tester. */
  access?: { tester: boolean };
  /** ai_consent: the wording they agreed to. */
  consent?: { version: number };
}

/** Answers ai_access and ai_consent from `world`, and records what is written to consent. */
function fakeDb(world: World) {
  const written: { upsert?: Record<string, unknown>; deletedFor?: unknown; deletedFrom: string[] } =
    {
      deletedFrom: [],
    };
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data:
                table === "ai_access"
                  ? world.access
                    ? { profile_id: "u", ...world.access }
                    : null
                  : (world.consent ?? null),
              error: null,
            }),
        }),
      }),
      upsert: (values: Record<string, unknown>) => {
        written.upsert = values;
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: (_column: string, id: unknown) => {
          written.deletedFor = id;
          written.deletedFrom.push(table);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  } as unknown as Pick<Db, "from">;
  return { db, written };
}

async function asAdmin<T>(run: () => Promise<T>): Promise<T> {
  const before = Deno.env.get("ADMIN_USER_IDS");
  Deno.env.set("ADMIN_USER_IDS", ADMIN);
  try {
    return await run();
  } finally {
    if (before === undefined) Deno.env.delete("ADMIN_USER_IDS");
    else Deno.env.set("ADMIN_USER_IDS", before);
  }
}

Deno.test("a yes counts only under today's wording", async () => {
  assertEquals(await aiConsented(fakeDb({}).db, "u"), false);
  assertEquals(await aiConsented(fakeDb({ consent: { version: CONSENT_VERSION } }).db, "u"), true);
  assertEquals(
    await aiConsented(fakeDb({ consent: { version: CONSENT_VERSION - 1 } }).db, "u"),
    false,
  );
});

Deno.test("calendar content needs AI on and a yes", async () => {
  const on = { access: { tester: false } };
  // AI on, no yes: refused.
  assertEquals(await aiContentAllowed(fakeDb(on).db, "u"), false);
  // AI on and a yes: allowed.
  assertEquals(
    await aiContentAllowed(fakeDb({ ...on, consent: { version: CONSENT_VERSION } }).db, "u"),
    true,
  );
  // A yes with no AI switched on for them: still refused.
  assertEquals(
    await aiContentAllowed(fakeDb({ consent: { version: CONSENT_VERSION } }).db, "u"),
    false,
  );
  // A yes to older wording: asked again, refused meanwhile.
  assertEquals(
    await aiContentAllowed(fakeDb({ ...on, consent: { version: CONSENT_VERSION - 1 } }).db, "u"),
    false,
  );
});

Deno.test("testers and admins may while it is tested, with or without a yes", async () => {
  assertEquals(await aiContentAllowed(fakeDb({ access: { tester: true } }).db, "u"), true);
  assertEquals(await asAdmin(() => aiContentAllowed(fakeDb({}).db, ADMIN)), true);
});

Deno.test("saying yes records the wording; taking it back deletes the row", async () => {
  const yes = fakeDb({});
  await setAiConsent(yes.db, "u", true);
  assertEquals(yes.written.upsert?.profile_id, "u");
  assertEquals(yes.written.upsert?.version, CONSENT_VERSION);

  const no = fakeDb({});
  await setAiConsent(no.db, "u", false);
  assertEquals(no.written.deletedFor, "u");
  // The facts shared for ranking dates (#119) go with the yes.
  assertEquals(no.written.deletedFrom, ["ai_consent", "ai_day_facts"]);
  assertEquals(no.written.upsert, undefined);
  assertEquals(yes.written.deletedFrom, []);
});
