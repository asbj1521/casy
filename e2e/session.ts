/**
 * Mia's made-up login: the user and session the fake backend hands auth-js,
 * shared by the browser tests (fixtures.ts) and the app's fake backend over
 * HTTP (scripts/native/fake-backend.ts, for the native parity shots, #280).
 * Nobody issued it and nothing checks its signature.
 */
import { ME, NOW } from "./world";

/** Lets a page on another origin (the app's capacitor://localhost) call the fake backend. */
export const CORS = {
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

export const user = {
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

export function session(over: Record<string, unknown> | null = null) {
  // A year past NOW: the stopped clock never reaches it, so auth-js never refreshes.
  const expiresAt = Math.floor(Date.parse(NOW) / 1000) + 365 * 24 * 3600;
  return {
    access_token: fakeAccessToken(expiresAt),
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: over ? { ...user, ...over } : user,
  };
}
