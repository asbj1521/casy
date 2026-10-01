import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import { handle, HttpError, readRange, requireString } from "./http.ts";

const post = (body: string, lang = "en") =>
  new Request(`https://x.test/fn?lang=${lang}`, { method: "POST", body });

/** A handler that sends back the body it was given. */
const echo = (_req: Request, body: Record<string, unknown>) => Promise.resolve({ body });

Deno.test("a preflight gets the CORS headers and nothing else", async () => {
  const preflight = new Request("https://x.test/fn", { method: "OPTIONS" });
  const res = await handle("fn", echo, "POST")(preflight);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.text(), "");
});

Deno.test("what a handler returns is sent as JSON, with CORS", async () => {
  const res = await handle("fn", echo, "POST")(post('{"action":"list"}'));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.json(), { body: { action: "list" } });
});

Deno.test("an empty POST body reads as no fields", async () => {
  const res = await handle("fn", echo, "POST")(post(""));
  assertEquals(await res.json(), { body: {} });
});

Deno.test("the wrong method and a body that isn't a JSON object are refused", async () => {
  const serve = handle("fn", echo, "POST");
  const get = await serve(new Request("https://x.test/fn"));
  assertEquals([get.status, await get.json()], [405, { error: "Use POST" }]);
  for (const body of ["{", "[1, 2]", "null", "42"]) {
    const res = await serve(post(body));
    assertEquals([res.status, await res.json()], [400, { error: "Body must be a JSON object" }]);
  }
});

Deno.test("an HttpError is answered in the caller's language, extra fields kept", async () => {
  const refuse = () => Promise.reject(new HttpError(401, "Please sign in again.", { events: [] }));
  const res = await handle("fn", refuse, "POST")(post("{}", "da"));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { events: [], error: "Log ind igen." });
});

Deno.test("any other failure is logged under its action and answered 500", async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    const crash = () => Promise.reject(new Error("connection reset"));
    const res = await handle("groups", crash, "POST")(post('{"action":"list"}', "da"));
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: "Noget gik galt. Prøv igen." });
    assertEquals(logged[0][0], "groups list failed");
  } finally {
    console.error = original;
  }
});

Deno.test("a required field must be text", () => {
  assertEquals(requireString({ groupId: "g1" }, "groupId"), "g1");
  assertThrows(() => requireString({ groupId: 7 }, "groupId"), HttpError, "groupId is required");
  assertThrows(() => requireString({}, "groupId"), HttpError, "groupId is required");
});

Deno.test("a range is two ISO timestamps in order, at most 400 days apart", () => {
  const { from, to } = readRange("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");
  assertEquals(
    [from.toISOString(), to.toISOString()],
    ["2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"],
  );
  assertThrows(() => readRange("2026-11-01T00:00:00Z", "2026-10-01T00:00:00Z"), HttpError);
  assertThrows(() => readRange("soon", "later"), HttpError);
  assertThrows(() => readRange(1, 2), HttpError);
  assertThrows(
    () => readRange("2026-01-01T00:00:00Z", "2027-03-01T00:00:00Z"),
    HttpError,
    "Range is limited to 400 days",
  );
});
