/**
 * Supabase Auth, the only part of Supabase the browser uses: data flows
 * through the Edge Functions (supabaseFunctions.ts), since RLS keeps every
 * table closed to the browser. The client keeps the session in localStorage
 * and refreshes its access token on its own, so a signed-in person stays
 * signed in across reloads without any code of ours.
 *
 * This is auth-js on its own rather than supabase-js, which would also ship
 * the database, realtime, storage and functions clients.
 */
import { AuthClient } from "@supabase/auth-js";

/**
 * The options supabase-js's createClient() used to give auth-js. Above all,
 * the storage key must stay the same: a different key reads as signed out
 * for everyone.
 */
export function authOptions(supabaseUrl: string, key: string) {
  const projectUrl = new URL(supabaseUrl.trim().replace(/\/?$/, "/"));
  return {
    url: new URL("auth/v1", projectUrl).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    storageKey: `sb-${projectUrl.hostname.split(".")[0]}-auth-token`,
    autoRefreshToken: true,
    persistSession: true,
    // Google sign-in and the email links come back with the session in the URL.
    detectSessionInUrl: true,
    flowType: "implicit" as const,
  };
}

export const supabaseAuth = new AuthClient(
  authOptions(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY),
);
