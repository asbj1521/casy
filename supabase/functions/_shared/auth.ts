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

/** The signed-in caller; anyone without a valid login is answered 401. */
export async function requireCaller(req: Request, db: Db): Promise<Caller> {
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (token) {
    const { data } = await db.auth.getUser(token);
    if (data.user) return data.user;
  }
  throw new HttpError(401, "Please sign in again.");
}
