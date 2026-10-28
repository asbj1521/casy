/**
 * Sends the push notifications that are waiting (#139, _shared/pushQueue.ts).
 *
 * Only the database calls it: a trigger tells it, over pg_net, that something
 * was queued, and proves it is the database with the shared secret in
 * `x-sync-secret` (the same one as the hourly calendar sync's, kept in Vault).
 * Nobody signed in can call it; there is nothing to ask of it. The work goes
 * on after a quick 202, as the database does not wait for the result.
 */
import { apnsKeyFromEnv } from "../_shared/apns.ts";
import { afterResponse, HttpError, json, serve } from "../_shared/http.ts";
import { drainQueue, sameSecret } from "../_shared/pushQueue.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("push", async (req) => {
  const presented = req.headers.get("x-sync-secret");
  const expected = Deno.env.get("CALENDAR_SYNC_SECRET");
  if (!presented || !expected || !sameSecret(presented, expected)) {
    throw new HttpError(401, "Not allowed");
  }
  const db = supabaseAdmin();
  const key = apnsKeyFromEnv();
  afterResponse("push queue", async () => {
    const outcome = await drainQueue(db, key);
    if (outcome.claimed > 0) console.log("push queue", outcome);
  });
  return json({ queued: true }, 202);
});
