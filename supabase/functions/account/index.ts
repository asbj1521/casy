/**
 * The signed-in person's own account. One action so far:
 *
 * - delete: deletes the account and everything it owns, after the page has
 *   asked them to type a word to confirm (sent as `confirm: true`, so a stray
 *   call can't do it). See _shared/accounts.ts for what goes and what stays.
 *
 * Only ever the caller's own account: the id comes from their verified login
 * (_shared/auth.ts), never from the request.
 */
import { deleteAccount } from "../_shared/accounts.ts";
import { callerId } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { withLanguage } from "../_shared/i18n.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(
  withLanguage(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);

    let payload: { action?: unknown; confirm?: unknown };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Body must be JSON" }, 400);
    }

    const db = supabaseAdmin();
    const profileId = await callerId(req, db);
    if (!profileId) return json({ error: "Please sign in again." }, 401);

    switch (payload.action) {
      case "delete": {
        if (payload.confirm !== true) return json({ error: "confirm must be true" }, 400);
        try {
          const { leftGroups, deletedGroups } = await deleteAccount(db, profileId);
          console.log(
            `account ${profileId} deleted itself; left ${leftGroups} groups, ${deletedGroups} deleted`,
          );
          return json({ outcome: "deleted" });
        } catch (err) {
          console.error("account delete failed", profileId, err);
          return json({ error: "Couldn't delete your account. Please try again." }, 500);
        }
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  }),
);
