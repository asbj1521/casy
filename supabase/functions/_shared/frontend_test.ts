// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import { allowedFrontends, inviteFrontend, pickFrontend } from "./frontend.ts";

const ALLOWED = ["https://casy.vercel.app", "http://localhost:8080"];

Deno.test("an allowed origin is returned to", () => {
  assertEquals(pickFrontend("http://localhost:8080", ALLOWED), "http://localhost:8080");
  assertEquals(pickFrontend("https://casy.vercel.app", ALLOWED), "https://casy.vercel.app");
});

Deno.test("anything else goes to the default site", () => {
  assertEquals(pickFrontend("https://evil.example", ALLOWED), "https://casy.vercel.app");
  assertEquals(
    pickFrontend("https://casy.vercel.app.evil.example", ALLOWED),
    "https://casy.vercel.app",
  );
  assertEquals(pickFrontend("not a url", ALLOWED), "https://casy.vercel.app");
  assertEquals(pickFrontend(null, ALLOWED), "https://casy.vercel.app");
});

Deno.test(
  "an invite made in the app points to the default site, from wherever the app is served",
  () => {
    // Live reload serves the app from the dev server, an allowed origin.
    assertEquals(inviteFrontend("http://localhost:8080", true, ALLOWED), "https://casy.vercel.app");
    assertEquals(inviteFrontend(null, true, ALLOWED), "https://casy.vercel.app");
    // The website keeps the address the person is on.
    assertEquals(inviteFrontend("http://localhost:8080", false, ALLOWED), "http://localhost:8080");
    assertEquals(inviteFrontend("https://evil.example", false, ALLOWED), "https://casy.vercel.app");
  },
);

Deno.test("paths are ignored: only the origin counts", () => {
  assertEquals(pickFrontend("http://localhost:8080/profile?x=1", ALLOWED), "http://localhost:8080");
});

Deno.test("the allowlist comes from FRONTEND_ORIGINS, then FRONTEND_URL", () => {
  const saved = [Deno.env.get("FRONTEND_ORIGINS"), Deno.env.get("FRONTEND_URL")];
  try {
    Deno.env.set("FRONTEND_ORIGINS", " https://casy.vercel.app/ , http://localhost:8080 ");
    assertEquals(allowedFrontends(), ALLOWED);
    Deno.env.delete("FRONTEND_ORIGINS");
    Deno.env.set("FRONTEND_URL", "http://localhost:8080");
    assertEquals(allowedFrontends(), ["http://localhost:8080"]);
  } finally {
    if (saved[0] === undefined) Deno.env.delete("FRONTEND_ORIGINS");
    else Deno.env.set("FRONTEND_ORIGINS", saved[0]);
    if (saved[1] === undefined) Deno.env.delete("FRONTEND_URL");
    else Deno.env.set("FRONTEND_URL", saved[1]);
  }
});
