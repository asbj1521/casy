import { assert, assertFalse } from "jsr:@std/assert@1";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

import { signForTest, verifyWebhook } from "./webhookSignature.ts";

const SECRET = `v1,whsec_${encodeBase64(new TextEncoder().encode("a test secret of some length"))}`;
const NOW = 1_790_000_000;
const BODY = '{"user":{"id":"u1"},"email_data":{"email_action_type":"magiclink"}}';

const headersFor = async (body = BODY, timestamp = NOW, secret = SECRET) => ({
  id: "msg_1",
  timestamp: String(timestamp),
  signature: await signForTest(secret, "msg_1", timestamp, body),
});

Deno.test("accepts a body signed with the hook's secret", async () => {
  assert(await verifyWebhook(SECRET, await headersFor(), BODY, NOW));
});

Deno.test("accepts the secret without its v1,whsec_ prefix too", async () => {
  assert(await verifyWebhook(SECRET.slice("v1,whsec_".length), await headersFor(), BODY, NOW));
});

Deno.test("accepts any one of several signatures (a secret being rotated)", async () => {
  const h = await headersFor();
  h.signature = `v1,bm90IGl0 ${h.signature}`;
  assert(await verifyWebhook(SECRET, h, BODY, NOW));
});

Deno.test("refuses a changed body", async () => {
  assertFalse(await verifyWebhook(SECRET, await headersFor(), BODY.replace("u1", "u2"), NOW));
});

Deno.test("refuses another secret's signature", async () => {
  const other = `v1,whsec_${encodeBase64(new TextEncoder().encode("someone else's secret"))}`;
  assertFalse(await verifyWebhook(SECRET, await headersFor(BODY, NOW, other), BODY, NOW));
});

Deno.test("refuses an old or future timestamp: replays don't work", async () => {
  assertFalse(await verifyWebhook(SECRET, await headersFor(BODY, NOW - 600), BODY, NOW));
  assertFalse(await verifyWebhook(SECRET, await headersFor(BODY, NOW + 600), BODY, NOW));
  assert(await verifyWebhook(SECRET, await headersFor(BODY, NOW - 60), BODY, NOW));
});

Deno.test("refuses missing headers", async () => {
  const h = await headersFor();
  assertFalse(await verifyWebhook(SECRET, { ...h, signature: null }, BODY, NOW));
  assertFalse(await verifyWebhook(SECRET, { ...h, id: null }, BODY, NOW));
  assertFalse(await verifyWebhook(SECRET, { ...h, timestamp: "soon" }, BODY, NOW));
});
