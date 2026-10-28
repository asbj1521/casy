/**
 * The short JWTs Apple's servers take instead of a password, signed with a
 * key from the developer account (a .p8 file): Sign in with Apple's client
 * secret (appleSignIn.ts) and the token every push to APNs carries (apns.ts).
 * ES256, so WebCrypto's ECDSA signature is already the raw r||s form JWTs use.
 */
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { encodeBase64Url } from "jsr:@std/encoding@1/base64url";

/**
 * The key's raw PKCS#8 bytes. Takes the .p8 as downloaded, or with its line
 * breaks written as "\n" (how a secret pasted on one line often arrives).
 * `secret` names it in the error, so a wrong one is found at once.
 */
function pkcs8Bytes(pem: string, secret: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  try {
    return decodeBase64(body);
  } catch {
    throw new Error(`${secret} is not a .p8 private key.`);
  }
}

function base64UrlJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** A JWT signed with the .p8 key `pem`, its id `keyId` in the header. */
export async function signAppleJwt(
  pem: string,
  secret: string,
  keyId: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const header = base64UrlJson({ alg: "ES256", kid: keyId });
  const payload = base64UrlJson(claims);
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Bytes(pem, secret),
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
