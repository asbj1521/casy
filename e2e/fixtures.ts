/**
 * What every browser test starts from: the site built against a made-up
 * Supabase project (playwright.config.ts), signed in as Mia with a session
 * nobody issued, the clock stopped at NOW, and every call to Supabase
 * answered by the fake backend. Nothing ever reaches the live project.
 *
 * Use `test` and `expect` from here instead of @playwright/test.
 */
import { test as base, expect, type Page } from "@playwright/test";

import { FakeBackend } from "./backend";
import { DEFAULT_WORLD, makeWorld, ME, NOW, type WorldOptions } from "./world";

/** The project the build talks to (playwright.config.ts sets it). */
export const SUPABASE_URL = "https://test-project.supabase.co";
/** auth-js's storage key for it (authOptions in src/lib/supabase.ts). */
const SESSION_KEY = "sb-test-project-auth-token";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

/** An access token that looks like Supabase's to auth-js; nobody checks its signature. */
function fakeAccessToken(exp: number): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return [
    part({ alg: "HS256", typ: "JWT" }),
    part({ sub: ME.id, email: ME.email, role: "authenticated", aud: "authenticated", exp }),
    "e2e",
  ].join(".");
}

const user = {
  id: ME.id,
  aud: "authenticated",
  role: "authenticated",
  email: ME.email,
  email_confirmed_at: "2026-09-01T10:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: ME.name, lang: "da" },
  identities: [],
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
};

function session() {
  // A year past NOW: the stopped clock never reaches it, so auth-js never refreshes.
  const expiresAt = Math.floor(Date.parse(NOW) / 1000) + 365 * 24 * 3600;
  return {
    access_token: fakeAccessToken(expiresAt),
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user,
  };
}

/** Sends every Supabase request to `backend`, and records the ones it can't answer. */
async function routeSupabase(page: Page, backend: FakeBackend) {
  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const fulfil = (status: number, json?: unknown) =>
      route.fulfill({
        status,
        headers: CORS,
        contentType: "application/json",
        body: json === undefined ? "" : JSON.stringify(json),
      });

    const fn = url.pathname.match(/^\/functions\/v1\/([\w-]+)$/)?.[1];
    if (fn) {
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      const { status, json } = backend.answer({ name: fn, params: url.searchParams, body });
      return fulfil(status, json);
    }
    if (url.pathname === "/auth/v1/user") return fulfil(200, user);
    if (url.pathname === "/auth/v1/logout") return fulfil(204);
    if (url.pathname === "/auth/v1/token") return fulfil(200, session());
    backend.unknown.push(`${request.method()} ${url.pathname}`);
    return fulfil(404, { error: "not in the test backend" });
  });
  // Live updates (src/lib/livePush.ts): the socket opens and stays quiet, as
  // if nobody else ever changed anything. The pulse still answers.
  await page.routeWebSocket(/\/realtime\/v1\//, () => {});
  // Google's and Microsoft's consent screens, as far as the tests go.
  await page.route("https://consent.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Consent screen</h1>" }),
  );
  // The leaked-password check (src/lib/passwordRules.ts): never leaked.
  await page.route("https://api.pwnedpasswords.com/**", (route) => route.fulfill({ body: "" }));
}

interface Options {
  /** What the backend's world holds. */
  world: WorldOptions;
  /** Start signed in as Mia (the default), or signed out. */
  signedIn: boolean;
}

interface Fixtures {
  backend: FakeBackend;
}

export const test = base.extend<Options & Fixtures>({
  world: [DEFAULT_WORLD, { option: true }],
  signedIn: [true, { option: true }],

  backend: async ({ world }, use) => {
    await use(new FakeBackend(makeWorld(world)));
  },

  page: async ({ page, backend, signedIn }, use) => {
    await page.clock.setFixedTime(new Date(NOW));
    await page.addInitScript(
      ({ key, value }) => {
        // The same "random" numbers on every load (the scheduler's starting
        // settings, which example group shows): a small seeded generator.
        let seed = 20261007;
        Math.random = () => {
          seed = (seed + 0x6d2b79f5) | 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // Signed in once per tab, so signing out in a test stays signed out.
        if (value && !sessionStorage.getItem("e2e-seeded")) {
          localStorage.setItem(key, value);
        }
        sessionStorage.setItem("e2e-seeded", "1");
      },
      { key: SESSION_KEY, value: signedIn ? JSON.stringify(session()) : "" },
    );
    await routeSupabase(page, backend);

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await use(page);

    expect(backend.unknown, "calls the test backend doesn't answer").toEqual([]);
    expect(errors, "errors thrown in the page").toEqual([]);
  },
});

export { expect };
