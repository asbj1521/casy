import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertThrows,
} from "jsr:@std/assert@1";

import { isLimited, recipientKey, refusal, verdictOf } from "./authEmailLimits.ts";

Deno.test("recipientKey is one hex HMAC per address, whatever its spelling", async () => {
  const key = await recipientKey("v1,whsec_test", "Mia@Example.com");
  assertMatch(key, /^[0-9a-f]{64}$/);
  assertEquals(await recipientKey("v1,whsec_test", "  mia@example.com "), key);
  assertNotEquals(await recipientKey("v1,whsec_test", "sara@example.com"), key);
});

Deno.test(
  "recipientKey depends on the secret, so a key can't be guessed from an address",
  async () => {
    assertNotEquals(
      await recipientKey("v1,whsec_one", "mia@example.com"),
      await recipientKey("v1,whsec_two", "mia@example.com"),
    );
  },
);

Deno.test("only what anyone can ask for with an address is limited", () => {
  for (const type of ["signup", "magiclink", "recovery"]) assert(isLimited(type), type);
  for (const type of [
    "reauthentication",
    "email_change",
    "password_changed_notification",
    "email_changed_notification",
    "identity_linked_notification",
  ]) {
    assert(!isLimited(type), type);
  }
});

Deno.test("verdictOf reads the database's answer and refuses anything else", () => {
  assertEquals(verdictOf({ ok: true }), "ok");
  assertEquals(verdictOf({ exhausted: "address" }), "address");
  assertEquals(verdictOf({ exhausted: "all" }), "all");
  assertThrows(() => verdictOf(null));
  assertThrows(() => verdictOf({ exhausted: "user" }));
});

Deno.test("refusals are said in both languages, with no long dashes or emojis", () => {
  for (const verdict of ["address", "all"] as const) {
    for (const lang of ["da", "en"] as const) {
      const text = refusal(verdict, lang);
      assert(text.length > 10);
      assert(!/[–—]/.test(text), text);
      assert(!/\p{Extended_Pictographic}/u.test(text), text);
    }
  }
  assertNotEquals(refusal("address", "da"), refusal("address", "en"));
});
