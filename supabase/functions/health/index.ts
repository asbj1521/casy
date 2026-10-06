/**
 * Is Casy's calendar syncing working? (#88) A plain GET for an uptime monitor:
 * 200 `{ ok: true }` when it is, 503 `{ ok: false, reason }` when no account
 * has synced for three hours ("stale", e.g. the hourly scheduler stopped) or
 * many are failing ("failing"). The monitor emails the operator on a 503.
 *
 * Public and without a login on purpose: it says nothing but those words
 * (_shared/health.ts), and costs three small counting queries.
 */
import { healthOf, readSyncFacts } from "../_shared/health.ts";
import { json, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve(
  "health",
  async () => {
    const health = healthOf(await readSyncFacts(supabaseAdmin()));
    return health.ok ? health : json(health, 503);
  },
  "GET",
);
