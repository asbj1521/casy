// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assert, assertEquals } from "jsr:@std/assert@1";
import { encryptSecret } from "./secretBox.ts";
import { syncConnection } from "./sync.ts";

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const NOW = new Date("2026-09-20T12:00:00.000Z");

/**
 * Just enough of the Supabase client for syncConnection: serves one
 * connection's secrets and calendars, and records every update and rpc call.
 */
function fakeDb(
  secrets: Record<string, unknown> | null,
  sources: { id: string; external_calendar_id: string }[],
  cached: { source_id: string; start_at: string; end_at: string }[] = [],
) {
  const updates: { table: string; payload: Record<string, unknown> }[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const db = {
    from(table: string) {
      let inIds: string[] = [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        in(_column: string, ids: string[]) {
          inIds = ids;
          return chain;
        },
        gt: () => chain,
        order: () => chain,
        range: () => Promise.resolve({ data: cached.filter((c) => inIds.includes(c.source_id)), error: null }),
        update(payload: Record<string, unknown>) {
          updates.push({ table, payload });
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: secrets, error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            table === "calendar_sources" ? { data: sources, error: null } : { data: null, error: null },
          ).then(resolve),
      };
      return chain;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcs.push({ fn, args });
      return Promise.resolve({ data: (args.p_blocks as unknown[]).length, error: null });
    },
  };
  return { db: db as unknown as Parameters<typeof syncConnection>[0], updates, rpcs };
}

/** Replace fetch for one test; returns the URLs it was asked for. */
function stubFetch(respond: (url: string) => Response): { urls: string[]; restore: () => void } {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(url);
    return Promise.resolve(respond(url));
  }) as typeof fetch;
  return { urls, restore: () => (globalThis.fetch = original) };
}

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//test//test//EN",
  "BEGIN:VEVENT",
  "UID:one",
  "DTSTAMP:20260101T000000Z",
  "DTSTART:20261001T100000Z",
  "DTEND:20261001T110000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const connectionUpdate = (updates: { table: string; payload: Record<string, unknown> }[]) =>
  updates.find((u) => u.table === "calendar_connections")!.payload;

Deno.test("an ICS link is fetched again and its busy times swapped in", async () => {
  const { db, updates, rpcs } = fakeDb(
    { ics_url: await encryptSecret("https://calendar.example.com/feed.ics", KEY) },
    [{ id: "source-1", external_calendar_id: "ics" }],
  );
  const net = stubFetch(() => new Response(FEED, { status: 200 }));
  try {
    const outcome = await syncConnection(db, { id: "conn-1", provider: "ics" }, KEY, NOW);
    assertEquals(outcome, { connectionId: "conn-1", ok: true, busyBlocks: 1 });
    assertEquals(net.urls, ["https://calendar.example.com/feed.ics"]);
  } finally {
    net.restore();
  }
  assertEquals(rpcs[0].fn, "replace_busy_blocks");
  assertEquals(rpcs[0].args.p_blocks, [
    { source_id: "source-1", start_at: "2026-10-01T10:00:00.000Z", end_at: "2026-10-01T11:00:00.000Z" },
  ]);
  const done = connectionUpdate(updates);
  assertEquals(done.sync_error, null);
  assertEquals(done.needs_reconnect, false);
  assertEquals(done.last_synced_at, NOW.toISOString());
});

Deno.test("a temporary failure keeps the old busy times and says it will retry", async () => {
  const { db, updates, rpcs } = fakeDb(
    { ics_url: await encryptSecret("https://calendar.example.com/feed.ics", KEY) },
    [{ id: "source-1", external_calendar_id: "ics" }],
  );
  const net = stubFetch(() => new Response("down", { status: 503 }));
  try {
    const outcome = await syncConnection(db, { id: "conn-1", provider: "ics" }, KEY, NOW);
    assertEquals(outcome.ok, false);
  } finally {
    net.restore();
  }
  assertEquals(rpcs, []); // nothing replaced, so nothing lost
  const failed = connectionUpdate(updates);
  assertEquals(failed.needs_reconnect, false);
  assert(String(failed.sync_error).includes("try again"));
  assertEquals(failed.last_synced_at, undefined); // still the last *good* sync
});

Deno.test("missing credentials mean the account must be reconnected", async () => {
  const { db, updates, rpcs } = fakeDb(null, [{ id: "source-1", external_calendar_id: "ics" }]);
  const outcome = await syncConnection(db, { id: "conn-1", provider: "ics" }, KEY, NOW);
  assertEquals(outcome.ok, false);
  assertEquals(rpcs, []);
  assertEquals(connectionUpdate(updates).needs_reconnect, true);
});

Deno.test("Google refusing the refresh token means reconnect, not retry", async () => {
  Deno.env.set("GOOGLE_OAUTH_CLIENT_ID", "client");
  Deno.env.set("GOOGLE_OAUTH_CLIENT_SECRET", "secret");
  const { db, updates, rpcs } = fakeDb(
    {
      access_token: await encryptSecret("old-access", KEY),
      refresh_token: await encryptSecret("dead-refresh", KEY),
      expires_at: "2026-09-19T00:00:00.000Z", // expired, so a refresh is needed
    },
    [{ id: "source-1", external_calendar_id: "primary" }],
  );
  const net = stubFetch(() => new Response('{"error": "invalid_grant"}', { status: 400 }));
  try {
    const outcome = await syncConnection(db, { id: "conn-1", provider: "google" }, KEY, NOW);
    assertEquals(outcome.ok, false);
  } finally {
    net.restore();
  }
  assertEquals(rpcs, []);
  const failed = connectionUpdate(updates);
  assertEquals(failed.needs_reconnect, true);
  assert(String(failed.sync_error).includes("Reconnect"));
});

Deno.test("a still-valid Google access token is used without refreshing", async () => {
  const { db, rpcs } = fakeDb(
    {
      access_token: await encryptSecret("good-access", KEY),
      refresh_token: await encryptSecret("refresh", KEY),
      expires_at: "2026-09-20T12:30:00.000Z", // half an hour left
    },
    [{ id: "source-1", external_calendar_id: "primary" }],
  );
  const net = stubFetch(() =>
    new Response(
      JSON.stringify({
        calendars: { primary: { busy: [{ start: "2026-10-02T08:00:00Z", end: "2026-10-02T09:00:00Z" }] } },
      }),
      { status: 200 },
    )
  );
  try {
    const outcome = await syncConnection(db, { id: "conn-1", provider: "google" }, KEY, NOW);
    assertEquals(outcome.ok, true);
    assert(net.urls.every((u) => u.includes("freeBusy")), "no token refresh expected");
  } finally {
    net.restore();
  }
  // Four 90-day chunks cover the year; the stub answers the same block to each.
  const blocks = rpcs[0].args.p_blocks as { source_id: string }[];
  assert(blocks.length > 0 && blocks.every((b) => b.source_id === "source-1"));
});

Deno.test("an event under way during a sync is stored whole, not cut to the sync time", async () => {
  // A lecture from 11:00 to 13:00, synced at 12:00 (NOW). It used to be
  // stored as 12:00-13:00, replacing the whole one for good.
  const lecture = FEED.replace("DTSTART:20261001T100000Z", "DTSTART:20260920T110000Z").replace(
    "DTEND:20261001T110000Z",
    "DTEND:20260920T130000Z",
  );
  const { db, rpcs } = fakeDb(
    { ics_url: await encryptSecret("https://calendar.example.com/feed.ics", KEY) },
    [{ id: "source-1", external_calendar_id: "ics" }],
  );
  const net = stubFetch(() => new Response(lecture, { status: 200 }));
  try {
    await syncConnection(db, { id: "conn-1", provider: "ics" }, KEY, NOW);
  } finally {
    net.restore();
  }
  const replace = rpcs.find((r) => r.fn === "replace_busy_blocks")!;
  assertEquals(replace.args.p_blocks, [
    { source_id: "source-1", start_at: "2026-09-20T11:00:00.000Z", end_at: "2026-09-20T13:00:00.000Z" },
  ]);
  // Everything from a week back is replaced, so last week is refreshed too.
  assertEquals(replace.args.p_from, "2026-09-13T12:00:00.000Z");
});

/* ---- iCloud: subscriptions read from their own feed ---- */

const multistatus = (responses: string) => `<?xml version='1.0'?><multistatus xmlns="DAV:">${responses}</multistatus>`;
const ok = (prop: string) => `<propstat><prop>${prop}</prop><status>HTTP/1.1 200 OK</status></propstat>`;
const ICLOUD_LISTING = multistatus(`
  <response><href>/111/calendars/WORK/</href>${ok(`
    <resourcetype><collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype>
    <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name="VEVENT"/></supported-calendar-component-set>`)}</response>
  <response><href>/111/calendars/SCHOOL/</href>${ok(`
    <resourcetype><collection/><subscribed xmlns="http://calendarserver.org/ns/"/></resourcetype>
    <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name="VEVENT"/></supported-calendar-component-set>
    <source xmlns="http://calendarserver.org/ns/"><href>webcal://school.example.com/feed.ics</href></source>`)}</response>`);

/** iCloud with one own calendar (one event) and one subscription; `feed` answers the school's server. */
function stubIcloud(feed: () => Response) {
  const original = globalThis.fetch;
  const seen: { host: string; auth: string | null }[] = [];
  const workEvent = FEED.replace("UID:one", "UID:work");
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    seen.push({ host: url.host, auth: req.headers.get("authorization") });
    if (url.host === "school.example.com") return Promise.resolve(feed());
    const body = url.pathname === "/"
      ? multistatus(`<response><href>/</href>${ok(`<current-user-principal><href>/111/principal/</href></current-user-principal>`)}</response>`)
      : url.pathname === "/111/principal/"
      ? multistatus(`<response><href>/111/principal/</href>${ok(`<calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"><href xmlns="DAV:">/111/calendars/</href></calendar-home-set>`)}</response>`)
      : url.pathname === "/111/calendars/"
      ? ICLOUD_LISTING
      : url.pathname === "/111/calendars/WORK/"
      ? multistatus(`<response><href>/111/calendars/WORK/w.ics</href>${ok(`<calendar-data xmlns="urn:ietf:params:xml:ns:caldav">${workEvent}</calendar-data>`)}</response>`)
      : null;
    return Promise.resolve(body ? new Response(body, { status: 207 }) : new Response("unexpected", { status: 500 }));
  }) as typeof fetch;
  return { seen, restore: () => (globalThis.fetch = original) };
}

const SCHOOL_FEED = FEED.replace("DTSTART:20261001T100000Z", "DTSTART:20261002T080000Z").replace(
  "DTEND:20261001T110000Z",
  "DTEND:20261002T090000Z",
);
const APPLE_SOURCES = [
  { id: "source-work", external_calendar_id: "WORK" },
  { id: "source-school", external_calendar_id: "SCHOOL" },
];
const appleSecrets = async () => ({
  caldav_username: "me@example.com",
  caldav_password: await encryptSecret("abcd-efgh-ijkl-mnop", KEY),
});

Deno.test("an iCloud subscription is read from its feed, without the iCloud password", async () => {
  const { db, rpcs } = fakeDb(await appleSecrets(), APPLE_SOURCES);
  const net = stubIcloud(() => new Response(SCHOOL_FEED, { status: 200 }));
  try {
    const outcome = await syncConnection(db, { id: "conn-1", provider: "apple" }, KEY, NOW);
    assertEquals(outcome.ok, true);
  } finally {
    net.restore();
  }
  assertEquals(rpcs.find((r) => r.fn === "replace_busy_blocks")!.args.p_blocks, [
    { source_id: "source-work", start_at: "2026-10-01T10:00:00.000Z", end_at: "2026-10-01T11:00:00.000Z" },
    { source_id: "source-school", start_at: "2026-10-02T08:00:00.000Z", end_at: "2026-10-02T09:00:00.000Z" },
  ]);
  const toSchool = net.seen.filter((s) => s.host === "school.example.com");
  assertEquals(toSchool.length, 1);
  assertEquals(toSchool[0].auth, null);
  // iCloud itself is never asked for the subscription's events.
  assert(!net.seen.some((s) => s.host.endsWith("icloud.com") && s.auth === null));
});

Deno.test("a subscription whose feed fails keeps its old times; the rest still syncs", async () => {
  const oldSchool = { source_id: "source-school", start_at: "2026-10-05T08:00:00.000Z", end_at: "2026-10-05T09:00:00.000Z" };
  const oldWork = { source_id: "source-work", start_at: "2026-10-06T08:00:00.000Z", end_at: "2026-10-06T09:00:00.000Z" };
  const { db, rpcs, updates } = fakeDb(await appleSecrets(), APPLE_SOURCES, [oldSchool, oldWork]);
  const net = stubIcloud(() => new Response("gone", { status: 404 }));
  try {
    const outcome = await syncConnection(db, { id: "conn-1", provider: "apple" }, KEY, NOW);
    assertEquals(outcome.ok, true);
  } finally {
    net.restore();
  }
  assertEquals(rpcs.find((r) => r.fn === "replace_busy_blocks")!.args.p_blocks, [
    { source_id: "source-work", start_at: "2026-10-01T10:00:00.000Z", end_at: "2026-10-01T11:00:00.000Z" },
    oldSchool, // kept; the work calendar's old block is replaced by its fresh one
  ]);
  assertEquals(connectionUpdate(updates).sync_error, null);
});
