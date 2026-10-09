/**
 * The iPhone app's phone calendars (#63): the app reads every calendar on the
 * phone (EventKit, one permission, no password) and sends their busy blocks
 * here, when connecting and whenever the app opens or the phone's calendars
 * change. Nothing is fetched by the server and no credential is stored: the
 * phone is the only source, so these connections are skipped by the hourly
 * sync, a group's refresh and the health check.
 *
 * Two ways in:
 *  - the app's page, signed in (requireCaller). It may ask for a device token
 *    (`issueToken`), which it hands to the app's native side;
 *  - the app's native background refresh, which runs without the page or the
 *    person's login: `x-device-token` instead. A token only ever updates its
 *    own phone's connection, never makes one, and a wrong token reads exactly
 *    like a removed connection.
 *
 * One push replaces the phone's calendars and busy times in one transaction
 * (sync_phone_calendars). A push for a phone whose connection was removed
 * (on the website, say) answers `{ gone: true }`, and the app stops sending;
 * only "Connect this phone" (`create: true`) makes a new one.
 */
import { requireCaller } from "../_shared/auth.ts";
import { serve } from "../_shared/http.ts";
import { hashDeviceToken, newDeviceToken, parsePhonePush } from "../_shared/phoneCalendars.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncWindow } from "../_shared/syncWindow.ts";

serve("calendar-phone", async (req, body) => {
  const db = supabaseAdmin();
  const now = new Date();
  const push = parsePhonePush(body, now);

  const deviceToken = req.headers.get("x-device-token");
  let profileId: string;
  if (deviceToken) {
    const { data: conn, error } = await db
      .from("calendar_connections")
      .select("profile_id")
      .eq("provider", "device")
      .eq("device_id", push.deviceId)
      .eq("device_token_hash", await hashDeviceToken(deviceToken))
      .maybeSingle();
    if (error) throw error;
    if (!conn) return { gone: true };
    profileId = conn.profile_id;
  } else {
    profileId = (await requireCaller(req, db)).id;
  }

  const { data, error } = await db.rpc("sync_phone_calendars", {
    p_profile_id: profileId,
    p_device_id: push.deviceId,
    p_label: push.label,
    p_create: push.create && !deviceToken,
    p_from: syncWindow(now).start.toISOString(),
    p_calendars: push.calendars,
  });
  if (error) throw error;
  const result = data as { gone?: boolean; connection_id?: string; busy_blocks?: number };
  if (result.gone) return { gone: true };

  // A new token replaces any earlier one: only the latest phone copy works.
  let issued: string | undefined;
  if (!deviceToken && body.issueToken === true) {
    issued = newDeviceToken();
    const { error: tokenErr } = await db
      .from("calendar_connections")
      .update({ device_token_hash: await hashDeviceToken(issued) })
      .eq("id", result.connection_id);
    if (tokenErr) throw tokenErr;
  }

  return {
    connectionId: result.connection_id,
    calendars: push.calendars.length,
    busyBlocks: result.busy_blocks ?? 0,
    ...(issued ? { deviceToken: issued } : {}),
  };
});
