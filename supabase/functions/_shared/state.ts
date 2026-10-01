/**
 * Signed OAuth "state" tokens.
 *
 * The state param round-trips through the provider (Google or Microsoft)
 * unmodified, so it's the only place to carry two things across that hop:
 * which profile is connecting, and proof the callback wasn't forged. Rather
 * than a database table of pending flows (one more thing to expire and
 * clean up), the state itself is a signed, self-contained token: HMAC-SHA256
 * over the payload using a secret only our functions know. If it verifies,
 * it's ours; if the signature or the timestamp is stale, it's rejected.
 */
import { decodeBase64Url, encodeBase64Url } from "jsr:@std/encoding@1/base64url";

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface OAuthStatePayload {
  /** The signed-in user connecting (auth.users id), verified in the start function. */
  profileId: string;
  /** Random per-request value; not currently checked against anything, but
   * keeps two states for the same profile from ever being identical. */
  nonce: string;
  /** Epoch ms the state was issued, so stale links can be rejected. */
  ts: number;
  /**
   * The site the connect started from, to return to afterwards. Signed like
   * the rest, and still checked against the allowlist (_shared/frontend.ts).
   */
  returnTo?: string;
}

const MAX_STATE_AGE_MS = 10 * 60_000; // 10 minutes: long enough for a consent screen, no longer.

/** Sign a state payload into the opaque string passed as the OAuth `state` param. */
export async function signState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const body = encodeBase64Url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${encodeBase64Url(sig)}`;
}

/**
 * Verify a state string from a callback request. Returns the payload if the
 * signature is valid and it isn't stale; null otherwise (never throws on bad
 * input; a forged or expired state is just an untrusted request, not a bug).
 */
export async function verifyState(
  state: string,
  secret: string,
): Promise<OAuthStatePayload | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const key = await hmacKey(secret);
    if (!(await crypto.subtle.verify("HMAC", key, decodeBase64Url(sig), encoder.encode(body)))) {
      return null;
    }
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(body)),
    ) as OAuthStatePayload;
    if (typeof payload.profileId !== "string" || typeof payload.ts !== "number") return null;
    if (Date.now() - payload.ts > MAX_STATE_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
