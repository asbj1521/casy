// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { decodeBase64Url, encodeBase64Url } from "jsr:@std/encoding@1/base64url";

import {
  APPLE_CLIENT_ID,
  type AppleKey,
  appleSubjectOf,
  clientSecret,
  exchangeCode,
  revokeToken,
} from "./appleSignIn.ts";

/** A made-up Sign in with Apple key: a fresh P-256 pair, the private half as a .p8. */
async function newKey(): Promise<{ key: AppleKey; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const lines = encodeBase64(der)
    .match(/.{1,64}/g)!
    .join("\n");
  return {
    key: {
      teamId: "TEAM123456",
      keyId: "KEY1234567",
      privateKey: `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`,
    },
    publicKey: pair.publicKey,
  };
}

const readPart = (jwt: string, i: number) =>
  JSON.parse(new TextDecoder().decode(decodeBase64Url(jwt.split(".")[i])));

const idToken = (sub: string) =>
  `${encodeBase64Url(new TextEncoder().encode('{"alg":"RS256"}'))}.${encodeBase64Url(
    new TextEncoder().encode(JSON.stringify({ sub, aud: APPLE_CLIENT_ID })),
  )}.signature`;

type Handler = (req: Request) => Response | Promise<Response>;

async function withFetch(handler: Handler, body: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(new Request(input, init)))) as typeof fetch;
  try {
    await body();
  } finally {
    globalThis.fetch = real;
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

Deno.test("the client secret is a five-minute ES256 JWT from the team, about the app", async () => {
  const { key, publicKey } = await newKey();
  const now = new Date("2026-10-27T12:00:00Z");
  const jwt = await clientSecret(key, now);

  assertEquals(readPart(jwt, 0), { alg: "ES256", kid: "KEY1234567" });
  const iat = now.getTime() / 1000;
  assertEquals(readPart(jwt, 1), {
    iss: "TEAM123456",
    iat,
    exp: iat + 300,
    aud: "https://appleid.apple.com",
    sub: "app.casy",
  });
  const [header, payload, signature] = jwt.split(".");
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    decodeBase64Url(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  assert(valid, "the signature checks out with the key's public half");
});

Deno.test("a key pasted on one line, with \\n for its line breaks, works the same", async () => {
  const { key } = await newKey();
  const oneLine = { ...key, privateKey: key.privateKey.replace(/\n/g, "\\n") };
  assertEquals((await clientSecret(oneLine)).split(".").length, 3);
});

Deno.test("a value that isn't a .p8 key says which secret is wrong", async () => {
  const { key } = await newKey();
  await assertRejects(
    () => clientSecret({ ...key, privateKey: "not a key!" }),
    Error,
    "APPLE_SIGN_IN_KEY",
  );
});

Deno.test("the code is traded for a refresh token and the Apple user it belongs to", async () => {
  const { key } = await newKey();
  let sent: URLSearchParams | null = null;
  await withFetch(
    async (req) => {
      assertEquals(req.url, "https://appleid.apple.com/auth/token");
      sent = new URLSearchParams(await req.text());
      return json({ refresh_token: "r.apple", id_token: idToken("001234.abcd") });
    },
    async () => {
      assertEquals(await exchangeCode("code-1", key), {
        refreshToken: "r.apple",
        subject: "001234.abcd",
      });
    },
  );
  assertEquals(sent!.get("client_id"), "app.casy");
  assertEquals(sent!.get("code"), "code-1");
  assertEquals(sent!.get("grant_type"), "authorization_code");
  assertEquals(sent!.get("client_secret")!.split(".").length, 3);
});

Deno.test("a code Apple refuses fails with Apple's reason", async () => {
  const { key } = await newKey();
  await withFetch(
    () => json({ error: "invalid_grant" }, 400),
    async () => {
      await assertRejects(() => exchangeCode("old", key), Error, "invalid_grant");
    },
  );
});

Deno.test("an answer without a refresh token is not taken as one", async () => {
  const { key } = await newKey();
  await withFetch(
    () => json({ id_token: idToken("001234.abcd") }),
    async () => {
      await assertRejects(() => exchangeCode("code", key), Error, "no refresh token");
    },
  );
});

Deno.test("revoking sends the refresh token to Apple's revoke endpoint", async () => {
  const { key } = await newKey();
  let sent: URLSearchParams | null = null;
  await withFetch(
    async (req) => {
      assertEquals(req.url, "https://appleid.apple.com/auth/revoke");
      sent = new URLSearchParams(await req.text());
      return new Response(null, { status: 200 });
    },
    () => revokeToken("r.apple", key),
  );
  assertEquals(sent!.get("token"), "r.apple");
  assertEquals(sent!.get("token_type_hint"), "refresh_token");
  assertEquals(sent!.get("client_id"), "app.casy");
});

Deno.test("a sign-in already ended at Apple counts as revoked", async () => {
  const { key } = await newKey();
  await withFetch(
    () => json({ error: "invalid_grant" }, 400),
    () => revokeToken("gone", key),
  );
});

Deno.test("any other failure to revoke throws, so the deletion can be tried again", async () => {
  const { key } = await newKey();
  await withFetch(
    () => json({ error: "invalid_client" }, 400),
    async () => {
      await assertRejects(() => revokeToken("r", key), Error, "invalid_client");
    },
  );
  await withFetch(
    () => new Response("down", { status: 503 }),
    async () => {
      await assertRejects(() => revokeToken("r", key), Error, "HTTP 503");
    },
  );
});

Deno.test("the caller's Apple user comes from their Apple identity", () => {
  const caller = { id: "u1" };
  assertEquals(appleSubjectOf(caller), null);
  assertEquals(appleSubjectOf({ ...caller, identities: [{ provider: "email", id: "u1" }] }), null);
  assertEquals(
    appleSubjectOf({
      ...caller,
      identities: [
        { provider: "email", id: "u1" },
        { provider: "apple", id: "001234.abcd", identity_data: { sub: "001234.abcd" } },
      ],
    }),
    "001234.abcd",
  );
  assertEquals(
    appleSubjectOf({ ...caller, identities: [{ provider: "apple", id: "001234.abcd" }] }),
    "001234.abcd",
  );
});
