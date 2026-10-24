import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { forgetTrustedCallers, requireCaller } from "./auth.ts";
import type { Db } from "./supabaseAdmin.ts";

/** A token whose payload says when it expires (seconds), as Supabase's do. */
function token(expSeconds: number): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64({ exp: expSeconds, sub: "u1" })}.sig`;
}

/** A stand-in for Supabase Auth that counts how often it is asked. */
function fakeDb(valid: boolean) {
  const asked = { n: 0 };
  const db = {
    auth: {
      getUser: () => {
        asked.n++;
        return Promise.resolve({ data: { user: valid ? { id: "u1" } : null } });
      },
    },
  } as unknown as Db;
  return { db, asked };
}

const request = (t: string) =>
  new Request("https://x", { headers: { Authorization: `Bearer ${t}` } });

Deno.test("a login checked once is trusted again for a while, without asking Auth", async () => {
  forgetTrustedCallers();
  const { db, asked } = fakeDb(true);
  const t = token(Math.floor(Date.now() / 1000) + 3600);
  assertEquals((await requireCaller(request(t), db)).id, "u1");
  assertEquals((await requireCaller(request(t), db)).id, "u1");
  assertEquals(asked.n, 1);
});

Deno.test("an expired token is never remembered, and a refused one is answered 401", async () => {
  forgetTrustedCallers();
  const { db, asked } = fakeDb(true);
  const old = token(Math.floor(Date.now() / 1000) - 10);
  await requireCaller(request(old), db);
  await requireCaller(request(old), db);
  assertEquals(asked.n, 2);

  const refused = fakeDb(false);
  await assertRejects(() => requireCaller(request(token(9_999_999_999)), refused.db));
});

Deno.test("no login at all is answered 401 without asking Auth", async () => {
  forgetTrustedCallers();
  const { db, asked } = fakeDb(true);
  await assertRejects(() => requireCaller(new Request("https://x"), db));
  assertEquals(asked.n, 0);
});
