// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

import { type ApnsKey, forgetProviderToken } from "./apns.ts";
import { drainQueue, sameSecret } from "./pushQueue.ts";
import type { Db } from "./supabaseAdmin.ts";

async function newKey(): Promise<ApnsKey> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return {
    teamId: "TEAM123456",
    keyId: "APNSKEY123",
    privateKey: `-----BEGIN PRIVATE KEY-----\n${encodeBase64(der)}\n-----END PRIVATE KEY-----\n`,
  };
}

interface World {
  queue: Record<string, unknown>[];
  events: Record<string, unknown>;
  groups: Record<string, unknown>;
  devices: Record<string, unknown>[];
  /** What was written back: inserts, updates and deletes, as "table op". */
  writes: { table: string; op: string; payload?: unknown; filters: Record<string, unknown> }[];
}

/** Just enough of the database client for the queue: every read answers from `world`. */
function fakeDb(world: World): Db {
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let op = "select";
    let payload: unknown;
    const answer = () => {
      if (op !== "select") {
        world.writes.push({ table, op, payload, filters: { ...filters } });
        return { data: null, error: null };
      }
      if (table === "push_devices") {
        return {
          data: world.devices.filter((d) => d.profile_id === filters.profile_id),
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      update: (p: unknown) => {
        op = "update";
        payload = p;
        return builder;
      },
      delete: () => {
        op = "delete";
        return builder;
      },
      insert: (p: unknown) => {
        op = "insert";
        payload = p;
        return builder;
      },
      maybeSingle: () => {
        const source = table === "event_proposals" ? world.events : world.groups;
        return Promise.resolve({ data: source[String(filters.id)] ?? null, error: null });
      },
      then: (resolve: (value: unknown) => unknown) => resolve(answer()),
    };
    return builder;
  };
  let claimed = false;
  return {
    from,
    rpc: () => {
      // The first claim hands over everything, the next finds the queue empty.
      const rows = claimed ? [] : world.queue;
      claimed = true;
      return Promise.resolve({ data: rows, error: null });
    },
  } as unknown as Db;
}

const row = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  profile_id: "p1",
  kind: "vote_invited",
  topic: "invited",
  proposal_id: "e1",
  group_id: null,
  actor_name: "Sara",
  attempts: 0,
  ...extra,
});

const world = (extra: Partial<World> = {}): World => ({
  queue: [row()],
  events: {
    e1: {
      title: "Grillaften",
      event_proposal_dates: [{ starts_at: "2026-11-14T18:00:00Z", chosen_at: null }],
    },
  },
  groups: { g1: { name: "Fredagsholdet" } },
  devices: [{ profile_id: "p1", token: "a".repeat(64), environment: "production", lang: "da" }],
  writes: [],
  ...extra,
});

/** Apple's answers for a run: every push is recorded, and answered by `answer`. */
async function withApple(
  answer: (req: Request) => Response,
  body: () => Promise<void>,
): Promise<Request[]> {
  const seen: Request[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(req.clone());
    return Promise.resolve(answer(req));
  }) as typeof fetch;
  forgetProviderToken();
  try {
    await body();
  } finally {
    globalThis.fetch = real;
  }
  return seen;
}

const ok = () => new Response(null, { status: 200 });
const refused = (status: number, reason: string) => () =>
  new Response(JSON.stringify({ reason }), { status });

Deno.test("a queued invitation is written in the phone's language and sent", async () => {
  const key = await newKey();
  const w = world();
  const seen = await withApple(ok, async () => {
    assertEquals(await drainQueue(fakeDb(w), key), { claimed: 1, sent: 1, dropped: 0 });
  });
  assertEquals(seen.length, 1);
  const body = await seen[0].json();
  assertEquals(body.aps.alert, { title: "Grillaften", body: "Sara foreslog datoer. Svar nu." });
  assertEquals(body.url, "/events/e1/dates");
  assertEquals(w.writes, []);
});

Deno.test("every phone of the person gets it, each in its own language", async () => {
  const key = await newKey();
  const w = world({
    devices: [
      { profile_id: "p1", token: "a".repeat(64), environment: "production", lang: "da" },
      { profile_id: "p1", token: "b".repeat(64), environment: "production", lang: "en" },
    ],
  });
  const seen = await withApple(ok, async () => {
    assertEquals((await drainQueue(fakeDb(w), key)).sent, 1);
  });
  const bodies = await Promise.all(seen.map((r) => r.json()));
  assertEquals(
    bodies.map((b) => b.aps.alert.body),
    ["Sara foreslog datoer. Svar nu.", "Sara suggested dates. Tap to answer."],
  );
});

Deno.test("a decided date reads from the vote's chosen date", async () => {
  const key = await newKey();
  const w = world({
    queue: [row({ kind: "vote_decided", topic: "decided", actor_name: null })],
    events: {
      e1: {
        title: "Grillaften",
        event_proposal_dates: [
          { starts_at: "2026-11-13T18:00:00Z", chosen_at: null },
          { starts_at: "2026-11-14T18:00:00Z", chosen_at: "2026-10-28T10:00:00Z" },
        ],
      },
    },
  });
  const seen = await withApple(ok, async () => {
    await drainQueue(fakeDb(w), key);
  });
  assertEquals((await seen[0].json()).aps.alert.body, "Datoen er fundet: lør. 14. nov. kl. 19:00");
});

Deno.test("a date said to be set, which has been reopened since, is not sent", async () => {
  const key = await newKey();
  const w = world({ queue: [row({ kind: "vote_decided", topic: "decided" })] });
  const seen = await withApple(ok, async () => {
    assertEquals(await drainQueue(fakeDb(w), key), { claimed: 1, sent: 0, dropped: 1 });
  });
  assertEquals(seen.length, 0);
});

Deno.test("an event deleted since, or a person without a phone, sends nothing", async () => {
  const key = await newKey();
  const gone = world({ events: {} });
  const noPhone = world({ devices: [] });
  await withApple(ok, async () => {
    assertEquals((await drainQueue(fakeDb(gone), key)).dropped, 1);
    assertEquals((await drainQueue(fakeDb(noPhone), key)).dropped, 1);
  });
});

Deno.test("a phone Apple says the app is gone from is forgotten", async () => {
  const key = await newKey();
  const w = world();
  await withApple(refused(410, "Unregistered"), async () => {
    assertEquals((await drainQueue(fakeDb(w), key)).dropped, 1);
  });
  assertEquals(
    w.writes.map((x) => [x.table, x.op, x.filters.token]),
    [["push_devices", "delete", "a".repeat(64)]],
  );
});

Deno.test("when Apple can't be reached the notification is put back, twice at most", async () => {
  const key = await newKey();
  const first = world();
  await withApple(refused(503, "ServiceUnavailable"), async () => {
    assertEquals((await drainQueue(fakeDb(first), key)).dropped, 0);
  });
  const back = first.writes.find((x) => x.table === "push_queue" && x.op === "insert");
  assertEquals((back?.payload as { attempts: number }).attempts, 1);

  const last = world({ queue: [row({ attempts: 2 })] });
  await withApple(refused(503, "ServiceUnavailable"), async () => {
    assertEquals((await drainQueue(fakeDb(last), key)).dropped, 1);
  });
  assertEquals(
    last.writes.filter((x) => x.table === "push_queue"),
    [],
  );
});

Deno.test("a secret is the same only when every byte is", () => {
  assertEquals(sameSecret("abc", "abc"), true);
  assertEquals(sameSecret("abc", "abd"), false);
  assertEquals(sameSecret("abc", "abcd"), false);
  assertEquals(sameSecret("", "a"), false);
});
