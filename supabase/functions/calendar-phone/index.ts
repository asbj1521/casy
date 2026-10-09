/**
 * The iPhone app's phone calendars (#63): the app reads every calendar on the
 * phone (EventKit, one permission, no password) and sends their busy blocks
 * here, when connecting and whenever the app opens or the phone's calendars
 * change. Nothing is fetched by the server and no credential is stored: the
 * phone is the only source, so these connections are skipped by the hourly
 * sync, a group's refresh and the health check.
 *
 * One push replaces the phone's calendars and busy times in one transaction
 * (sync_phone_calendars). A push for a phone whose connection was removed
 * (on the website, say) answers `{ gone: true }`, and the app stops sending;
 * only "Connect this phone" (`create: true`) makes a new one.
 *
 * Stored as the signed-in caller's.
 */
import { requireCaller } from "../_shared/auth.ts";
import { serve } from "../_shared/http.ts";
import { parsePhonePush } from "../_shared/phoneCalendars.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncWindow } from "../_shared/syncWindow.ts";

serve("calendar-phone", async (req, body) => {
  const db = supabaseAdmin();
  const { id: profileId } = await requireCaller(req, db);
  const now = new Date();
  const push = parsePhonePush(body, now);

  const { data, error } = await db.rpc("sync_phone_calendars", {
    p_profile_id: profileId,
    p_device_id: push.deviceId,
    p_label: push.label,
    p_create: push.create,
    p_from: syncWindow(now).start.toISOString(),
    p_calendars: push.calendars,
  });
  if (error) throw error;
  const result = data as { gone?: boolean; connection_id?: string; busy_blocks?: number };
  if (result.gone) return { gone: true };
  return {
    connectionId: result.connection_id,
    calendars: push.calendars.length,
    busyBlocks: result.busy_blocks ?? 0,
  };
});
