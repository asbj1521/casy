/**
 * The iPhone app's phone calendars (#63, #105). Nothing here is fetched by
 * the server and no credential is stored: the phone is the only one who can
 * read or write its calendars, so it comes here.
 *
 * Actions (`action` in the body; none means "sync", as the first app builds sent):
 *  - sync:    the phone's calendars and busy blocks, swapped in in one
 *             transaction (sync_phone_calendars). Only "Connect this phone"
 *             (`create`) makes the connection; a push for one removed since
 *             answers `{ gone: true }`, and the app stops sending.
 *  - writes:  what the phone should add to, change in or take out of its
 *             calendars, agreed events in a phone calendar chosen as primary
 *             (_shared/phoneWrites.ts), after queueing Add automatically's.
 *  - written: how that went, so the rows say what is in the calendar.
 *
 * Two ways in:
 *  - the app's page, signed in (requireCaller). On sync it may ask for a
 *    device token (`issueToken`), which it hands to the app's native side;
 *  - the app's native background refresh, which runs without the page or the
 *    person's login: `x-device-token` instead. A token only ever acts for its
 *    own phone's connection, never makes one, and a wrong token reads exactly
 *    like a removed connection.
 */
import { requireCaller } from "../_shared/auth.ts";
import { queueAutoAdds } from "../_shared/calendarWrites.ts";
import { serve } from "../_shared/http.ts";
import {
  hashDeviceToken,
  newDeviceToken,
  parseDeviceId,
  parsePhonePush,
} from "../_shared/phoneCalendars.ts";
import { applyPhoneReports, parseReports, phoneWork } from "../_shared/phoneWrites.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncWindow } from "../_shared/syncWindow.ts";

/** Who is asking: by the phone's token, or by the signed-in person. */
async function callerOf(
  req: Request,
  db: Db,
  deviceId: string,
): Promise<{ profileId: string; byToken: boolean } | null> {
  const deviceToken = req.headers.get("x-device-token");
  if (!deviceToken) return { profileId: (await requireCaller(req, db)).id, byToken: false };
  const { data: conn, error } = await db
    .from("calendar_connections")
    .select("profile_id")
    .eq("provider", "device")
    .eq("device_id", deviceId)
    .eq("device_token_hash", await hashDeviceToken(deviceToken))
    .maybeSingle();
  if (error) throw error;
  return conn ? { profileId: conn.profile_id, byToken: true } : null;
}

/** This phone's connection for the person, if it still exists. */
async function connectionOf(db: Db, profileId: string, deviceId: string): Promise<string | null> {
  const { data, error } = await db
    .from("calendar_connections")
    .select("id")
    .eq("profile_id", profileId)
    .eq("provider", "device")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

serve("calendar-phone", async (req, body) => {
  const db = supabaseAdmin();
  const action = body.action ?? "sync";

  if (action === "writes" || action === "written") {
    const deviceId = parseDeviceId(body);
    const reports = action === "written" ? parseReports(body) : [];
    const caller = await callerOf(req, db, deviceId);
    const connectionId = caller && (await connectionOf(db, caller.profileId, deviceId));
    if (!caller || !connectionId) return { gone: true };
    if (action === "written") {
      return { applied: await applyPhoneReports(db, connectionId, reports) };
    }
    // Events agreed since the phone last asked go in now, if it adds them automatically.
    await queueAutoAdds(db, { profileId: caller.profileId });
    return await phoneWork(db, connectionId);
  }

  const now = new Date();
  const push = parsePhonePush(body, now);
  const caller = await callerOf(req, db, push.deviceId);
  if (!caller) return { gone: true };

  const { data, error } = await db.rpc("sync_phone_calendars", {
    p_profile_id: caller.profileId,
    p_device_id: push.deviceId,
    p_label: push.label,
    p_create: push.create && !caller.byToken,
    p_from: syncWindow(now).start.toISOString(),
    p_calendars: push.calendars,
  });
  if (error) throw error;
  const result = data as { gone?: boolean; connection_id?: string; busy_blocks?: number };
  if (result.gone) return { gone: true };

  // A new token replaces any earlier one: only the latest phone copy works.
  // The calendars are saved by now, so a failure here only means no
  // background refresh until the next try, not a failed connect.
  let issued: string | undefined;
  if (!caller.byToken && body.issueToken === true) {
    const token = newDeviceToken();
    const { error: tokenErr } = await db
      .from("calendar_connections")
      .update({ device_token_hash: await hashDeviceToken(token) })
      .eq("id", result.connection_id);
    if (tokenErr) console.error("calendar-phone: storing the device token failed", tokenErr);
    else issued = token;
  }

  return {
    connectionId: result.connection_id,
    calendars: push.calendars.length,
    busyBlocks: result.busy_blocks ?? 0,
    ...(issued ? { deviceToken: issued } : {}),
  };
});
