/**
 * A Supabase client authenticated as the service role.
 *
 * This bypasses row-level security entirely, which is exactly why every
 * table has RLS on with no policies at all: the browser's roles can't read or
 * write anything, and the *only* code path meant to reach the tables is an
 * Edge Function using this client. Never send this client, or the key it's
 * built from, anywhere near the browser.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

import { requireEnv } from "./env.ts";

export function supabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

/** The client every module that touches the database is handed. */
export type Db = ReturnType<typeof supabaseAdmin>;
