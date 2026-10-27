/**
 * Sign in with Apple's server side (#138): what Casy keeps so the sign-in can
 * be revoked when the account is deleted, as the App Store requires.
 *
 * The app signs in natively (AppleSignInPlugin.swift) and hands Supabase Auth
 * Apple's identity token, which needs nothing from here. It also sends the
 * one-time authorization code that came with it (the account function's
 * `apple-token`): exchanged here for a refresh token, the one thing Apple's
 * revoke endpoint accepts, which is stored encrypted (secretBox.ts) until the
 * account is deleted (accounts.ts).
 *
 * Talking to Apple takes a client secret: a short JWT signed with the Sign in
 * with Apple key (.p8) from the developer account. It is made fresh for each
 * call and lives five minutes, so there is no secret that expires and has to
 * be renewed by hand (the website's Apple sign-in would need one; it has none).
 */
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { decodeBase64Url, encodeBase64Url } from "jsr:@std/encoding@1/base64url";

import type { Caller } from "./auth.ts";
import { requireEnv } from "./env.ts";
import { decryptSecret, encryptionKeyFromEnv, encryptSecret } from "./secretBox.ts";
import type { Db } from "./supabaseAdmin.ts";

/** The app's bundle id: the client a native sign-in's tokens are issued to. */
export const APPLE_CLIENT_ID = "app.casy";

const APPLE_ISSUER = "https://appleid.apple.com";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const REVOKE_URL = "https://appleid.apple.com/auth/revoke";
/** How long a client secret is good for: one call's worth. */
const SECRET_LIFETIME_SECONDS = 300;

/** The Sign in with Apple key, from the developer account. */
export interface AppleKey {
  teamId: string;
  keyId: string;
  /** The .p8 file's contents (PEM), as downloaded. */
  privateKey: string;
}

export function appleKeyFromEnv(): AppleKey {
  return {
    teamId: requireEnv("APPLE_TEAM_ID"),
    keyId: requireEnv("APPLE_KEY_ID"),
    privateKey: requireEnv("APPLE_SIGN_IN_KEY"),
  };
}

/**
 * The key's raw PKCS#8 bytes. Takes the .p8 as downloaded, or with its line
 * breaks written as "\n" (how a secret pasted on one line often arrives).
 */
function pkcs8Bytes(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  try {
    return decodeBase64(body);
  } catch {
    throw new Error("APPLE_SIGN_IN_KEY is not a .p8 private key.");
  }
}

function base64UrlJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * The client secret Apple asks for: a JWT (ES256) from Casy's team, about
 * the app, signed with the key. WebCrypto's ECDSA signature is already the
 * raw r||s form JWTs use.
 */
export async function clientSecret(key: AppleKey, now = new Date()): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64UrlJson({ alg: "ES256", kid: key.keyId });
  const payload = base64UrlJson({
    iss: key.teamId,
    iat: issuedAt,
    exp: issuedAt + SECRET_LIFETIME_SECONDS,
    aud: APPLE_ISSUER,
    sub: APPLE_CLIENT_ID,
  });
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Bytes(key.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${encodeBase64Url(signature)}`;
}

/** Apple's error code from a failed answer ("invalid_grant"), or the status. */
async function appleError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Not JSON: the status says enough.
  }
  return `HTTP ${res.status}`;
}

/**
 * Trade the sign-in's one-time code (good for five minutes) for a refresh
 * token, and the Apple user it belongs to. The identity token in the answer
 * comes straight from Apple over TLS, so its claims are read without
 * checking its signature (OpenID Connect allows exactly this case).
 */
export async function exchangeCode(
  code: string,
  key: AppleKey,
): Promise<{ refreshToken: string; subject: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      client_secret: await clientSecret(key),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Apple refused the code: ${await appleError(res)}`);
  const body = await res.json();
  const refreshToken = body?.refresh_token;
  const subject = subjectOf(body?.id_token);
  if (typeof refreshToken !== "string" || !refreshToken || !subject) {
    throw new Error("Apple's answer had no refresh token or user.");
  }
  return { refreshToken, subject };
}

/** The `sub` claim of an identity token: the Apple user, the same for every sign-in. */
function subjectOf(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(idToken.split(".")[1])));
    return typeof claims?.sub === "string" && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * End the sign-in at Apple: Casy disappears from the person's "Sign in with
 * Apple" list in their Apple account. A token Apple no longer knows (they
 * removed Casy there themselves) counts as done.
 */
export async function revokeToken(refreshToken: string, key: AppleKey): Promise<void> {
  const res = await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      client_secret: await clientSecret(key),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  if (res.ok) return;
  const error = await appleError(res);
  if (error === "invalid_grant") return;
  throw new Error(`Apple did not revoke the sign-in: ${error}`);
}

/** The Apple user the caller signs in as, or null without an Apple sign-in. */
export function appleSubjectOf(caller: Caller): string | null {
  const identity = caller.identities?.find((i) => i.provider === "apple");
  if (!identity) return null;
  const sub = identity.identity_data?.sub;
  if (typeof sub === "string" && sub) return sub;
  return identity.id || null;
}

/**
 * Keep the refresh token for the caller's Apple sign-in (each sign-in
 * replaces the last). Refused for a code from another Apple user than the
 * one the caller signs in as, so nobody can tie someone else's sign-in to
 * their account.
 */
export async function saveAppleSignIn(db: Db, caller: Caller, code: string): Promise<void> {
  const subject = appleSubjectOf(caller);
  if (!subject) throw new Error("The caller has no Apple sign-in.");
  const { refreshToken, subject: codeSubject } = await exchangeCode(code, appleKeyFromEnv());
  if (codeSubject !== subject) throw new Error("The code belongs to another Apple user.");
  const { error } = await db.from("apple_sign_ins").upsert({
    profile_id: caller.id,
    refresh_token: await encryptSecret(refreshToken, encryptionKeyFromEnv()),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Revoke the person's Apple sign-in, if Casy holds one; called before their
 * account is deleted (the row goes with the account). Throws if Apple can't
 * be reached, so the deletion stops and can be tried again rather than
 * leaving the sign-in alive with nothing left to revoke it with.
 */
export async function revokeAppleSignIn(db: Db, profileId: string): Promise<boolean> {
  const { data, error } = await db
    .from("apple_sign_ins")
    .select("refresh_token")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const refreshToken = await decryptSecret(data.refresh_token as string, encryptionKeyFromEnv());
  await revokeToken(refreshToken, appleKeyFromEnv());
  return true;
}
