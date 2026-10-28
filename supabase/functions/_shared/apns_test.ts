// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { decodeBase64Url } from "jsr:@std/encoding@1/base64url";

import { type ApnsKey, deliver, forgetProviderToken, providerToken } from "./apns.ts";

/** A made-up APNs key: a fresh P-256 pair, the private half as a .p8. */
async function newKey(): Promise<ApnsKey> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const lines = encodeBase64(der)
    .match(/.{1,64}/g)!
    .join("\n");
  return {
    teamId: "TEAM123456",
    keyId: "APNSKEY123",
    privateKey: `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`,
  };
}

const MESSAGE = { title: "Grillaften", body: "Sara foreslog datoer", url: "/events/e1/dates" };

type Handler = (req: Request) => Response | Promise<Response>;

/** The network replaced by `handler` for the length of `body`; answers the requests made. */
async function withFetch(handler: Handler, body: () => Promise<void>): Promise<Request[]> {
  const seen: Request[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push(req.clone());
    return Promise.resolve(handler(req));
  }) as typeof fetch;
  forgetProviderToken();
  try {
    await body();
  } finally {
    globalThis.fetch = real;
  }
  return seen;
}

const reason = (status: number, why: string) =>
  new Response(JSON.stringify({ reason: why }), { status });

Deno.test(
  "a push goes to production first, as an alert about the app, with the tap's path",
  async () => {
    const key = await newKey();
    const seen = await withFetch(
      () => new Response(null, { status: 200 }),
      async () => {
        assertEquals(await deliver("abc123", null, MESSAGE, key), {
          result: "sent",
          environment: "production",
        });
      },
    );
    assertEquals(seen.length, 1);
    assertEquals(seen[0].url, "https://api.push.apple.com/3/device/abc123");
    assertEquals(seen[0].headers.get("apns-topic"), "app.casy");
    assertEquals(seen[0].headers.get("apns-push-type"), "alert");
    assertEquals(await seen[0].json(), {
      aps: { alert: { title: "Grillaften", body: "Sara foreslog datoer" }, sound: "default" },
      url: "/events/e1/dates",
    });
  },
);

Deno.test(
  "a token from an Xcode build is tried on the sandbox when production doesn't know it",
  async () => {
    const key = await newKey();
    const seen = await withFetch(
      (req) =>
        req.url.includes("sandbox")
          ? new Response(null, { status: 200 })
          : reason(400, "BadDeviceToken"),
      async () => {
        assertEquals(await deliver("abc123", null, MESSAGE, key), {
          result: "sent",
          environment: "sandbox",
        });
      },
    );
    assertEquals(
      seen.map((r) => new URL(r.url).host),
      ["api.push.apple.com", "api.sandbox.push.apple.com"],
    );
  },
);

Deno.test("a token known to work on the sandbox goes there first", async () => {
  const key = await newKey();
  const seen = await withFetch(
    () => new Response(null, { status: 200 }),
    async () => {
      await deliver("abc123", "sandbox", MESSAGE, key);
    },
  );
  assertEquals(new URL(seen[0].url).host, "api.sandbox.push.apple.com");
});

Deno.test("an app gone from the phone, or a token neither server knows, is gone", async () => {
  const key = await newKey();
  await withFetch(
    () => reason(410, "Unregistered"),
    async () => {
      assertEquals(await deliver("old", "production", MESSAGE, key), { result: "gone" });
    },
  );
  await withFetch(
    () => reason(400, "BadDeviceToken"),
    async () => {
      assertEquals(await deliver("bad", null, MESSAGE, key), { result: "gone" });
    },
  );
});

Deno.test("any other refusal fails with Apple's reason, and isn't tried elsewhere", async () => {
  const key = await newKey();
  const seen = await withFetch(
    () => reason(403, "InvalidProviderToken"),
    async () => {
      assertEquals(await deliver("abc", null, MESSAGE, key), {
        result: "failed",
        reason: "InvalidProviderToken",
      });
    },
  );
  assertEquals(seen.length, 1);
});

Deno.test(
  "the provider token is the team's, signed with the key, and reused for a while",
  async () => {
    const key = await newKey();
    forgetProviderToken();
    const now = Date.parse("2026-10-28T12:00:00Z");
    const token = await providerToken(key, now);
    const [header, payload] = token
      .split(".")
      .map((part, i) =>
        i < 2 ? JSON.parse(new TextDecoder().decode(decodeBase64Url(part))) : part,
      );
    assertEquals(header, { alg: "ES256", kid: "APNSKEY123" });
    assertEquals(payload, { iss: "TEAM123456", iat: now / 1000 });
    assertEquals(await providerToken(key, now + 30 * 60_000), token);
    const later = await providerToken(key, now + 45 * 60_000);
    assertEquals(later === token, false);
  },
);
