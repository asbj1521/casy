/**
 * Who is calling: the one place an Edge Function learns the caller's identity.
 *
 * The browser sends the signed-in person's access token as
 * `Authorization: Bearer <token>`. Asking Supabase Auth about that token
 * both proves it is genuine (signed by this project, not expired, not revoked
 * by a sign-out) and tells us whose it is. Nothing the browser says about
 * itself in a body or query string is trusted for identity.
 *
 * The gateway's own JWT check stays off for these functions (verify_jwt =
 * false in config.toml): the publishable key the app sends when nobody is
 * signed in is not a JWT, so the gateway would reject requests before this
 * code could answer them with a proper 401.
 */
import { HttpError } from "./http.ts";
import type { Db } from "./supabaseAdmin.ts";

/** The verified caller, with as much of their login as naming them takes. */
export interface Caller {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  /** How they sign in ("providers"), set by Supabase Auth; read by "Your data". */
  app_metadata?: Record<string, unknown>;
  created_at?: string;
}

/**
 * How long a login checked with Supabase Auth is trusted again without
 * asking (#158): a page makes several calls to the same warm function, and
 * each check is a round trip. Never past the token's own expiry. The price:
 * a session revoked elsewhere (signed out on all devices, an account
 * deleted) still passes on a warm instance for at most this long.
 */
const TRUSTED_FOR_MS = 60_000;
/** At most this many logins remembered per function instance. */
const MAX_TRUSTED = 500;

const trusted = new Map<string, { caller: Caller; until: number }>();

/** When the token itself expires (its `exp`, in ms), or null if it can't be read. */
function expiresAt(token: string): number | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** For tests: forget every remembered login. */
export function forgetTrustedCallers(): void {
  trusted.clear();
}

/** The signed-in caller; anyone without a valid login is answered 401. */
export async function requireCaller(req: Request, db: Db): Promise<Caller> {
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token) {
    const now = Date.now();
    const known = trusted.get(token);
    if (known && known.until > now) return known.caller;
    if (known) trusted.delete(token);
    const { data } = await db.auth.getUser(token);
    if (data.user) {
      const exp = expiresAt(token);
      const until = Math.min(now + TRUSTED_FOR_MS, exp ?? now);
      if (until > now) {
        // The oldest goes first once the instance has remembered plenty.
        if (trusted.size >= MAX_TRUSTED) trusted.delete(trusted.keys().next().value!);
        trusted.set(token, { caller: data.user, until });
      }
      return data.user;
    }
  }
  throw new HttpError(401, "Please sign in again.");
}
