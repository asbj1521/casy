import { assertEquals } from "jsr:@std/assert@1";

import { signState, verifyState } from "./state.ts";

const SECRET = "test-state-secret";
const payload = (profileId = "user-1", ts = Date.now()) => ({
  profileId,
  nonce: "nonce",
  ts,
  returnTo: "https://casy.app",
});

Deno.test("a signed state verifies and carries its payload back", async () => {
  const sent = payload();
  assertEquals(await verifyState(await signState(sent, SECRET), SECRET), sent);
});

Deno.test("another secret, a swapped payload or an old state is refused", async () => {
  const state = await signState(payload(), SECRET);
  assertEquals(await verifyState(state, "another-secret"), null);

  const [, signature] = state.split(".");
  const [otherBody] = (await signState(payload("user-2"), SECRET)).split(".");
  assertEquals(await verifyState(`${otherBody}.${signature}`, SECRET), null);

  const old = await signState(payload("user-1", Date.now() - 11 * 60_000), SECRET);
  assertEquals(await verifyState(old, SECRET), null);
});

Deno.test("junk is refused without throwing", async () => {
  for (const junk of ["", "no-dot", "a.b.c", "!!!.###", "e30.e30"]) {
    assertEquals(await verifyState(junk, SECRET), null);
  }
});
