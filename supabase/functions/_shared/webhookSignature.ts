/**
 * Checking that a request really comes from Supabase Auth, for its hooks
 * (auth-email). Auth signs every hook call the Standard Webhooks way: an
 * HMAC-SHA256, keyed with the hook's secret, over "<id>.<timestamp>.<body>",
 * sent base64-encoded in the `webhook-signature` header as "v1,<signature>"
 * (several, space-separated, while a secret is being rotated).
 *
 * Done here with Web Crypto rather than the standardwebhooks package: it is a
 * few lines, it can be tested without the network, and it is one dependency
 * fewer on the path every sign-in email takes.
 */
import { decodeBase64, encodeBase64 } from "jsr:@std/encoding@1/base64";

/** How far a signed timestamp may be from now, either way: replays older than this fail. */
const TOLERANCE_SECONDS = 5 * 60;

/** The secret as the dashboard shows it, "v1,whsec_<base64>", or just the base64 part. */
export function secretKeyBytes(secret: string): Uint8Array<ArrayBuffer> {
  return decodeBase64(secret.replace(/^v1,/, "").replace(/^whsec_/, ""));
}

async function sign(key: Uint8Array<ArrayBuffer>, content: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(content));
  return encodeBase64(new Uint8Array(mac));
}

/** Equal strings, compared in time that doesn't depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The headers a signature needs, as Standard Webhooks names them. */
export interface SignedHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function signedHeaders(headers: Headers): SignedHeaders {
  return {
    id: headers.get("webhook-id"),
    timestamp: headers.get("webhook-timestamp"),
    signature: headers.get("webhook-signature"),
  };
}

/**
 * True when `body` was signed with `secret` within the last few minutes.
 * `nowSeconds` is for tests.
 */
export async function verifyWebhook(
  secret: string,
  headers: SignedHeaders,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const expected = await sign(secretKeyBytes(secret), `${id}.${timestamp}.${body}`);
  return signature
    .split(" ")
    .some((part) => part.startsWith("v1,") && sameText(part.slice(3), expected));
}

/** A signature header for `body`, as Auth would send it: for tests. */
export async function signForTest(
  secret: string,
  id: string,
  timestamp: number,
  body: string,
): Promise<string> {
  return `v1,${await sign(secretKeyBytes(secret), `${id}.${timestamp}.${body}`)}`;
}
