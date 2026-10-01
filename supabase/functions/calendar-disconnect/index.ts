/**
 * Remove one linked calendar account.
 *
 * Deleting the calendar_connections row cascades to its calendar_sources,
 * calendar_secrets and calendar_busy_cache rows (see the calendar_integrations
 * migration), so the tokens and every synced busy block go with it.
 *
 * This does NOT revoke the app's access at Google or Microsoft: the user can
 * still see Casy in their account's connected-apps settings and remove it
 * there. The profile page says so.
 *
 * Only a connection the signed-in caller owns can be removed.
 */
import { requireCaller } from "../_shared/auth.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

serve("calendar-disconnect", async (req, body) => {
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);
  const connectionId = requireString(body, "connectionId");

  // Filtering on profile_id as well means a connection can only be removed by
  // the person who owns it; a mismatch just deletes nothing.
  const { data, error } = await db
    .from("calendar_connections")
    .delete()
    .eq("id", connectionId)
    .eq("profile_id", profileId)
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, "Connection not found");
  return { removed: data[0].id };
});
