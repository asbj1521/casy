/**
 * Push notifications (#139): the phones a person said yes on, and sending to
 * them. What is sent and when comes later (the push queue); this is the part
 * every notification goes through.
 */
import { type ApnsEnvironment, apnsKeyFromEnv, deliver, type PushMessage } from "./apns.ts";
import { HttpError } from "./http.ts";
import type { Db } from "./supabaseAdmin.ts";

/** Apple's token for one phone: hex, 32 bytes today, possibly longer later. */
const TOKEN = /^[0-9a-f]{64,200}$/;

/** The token as stored, or a 400 for anything that isn't one. */
export function cleanToken(raw: unknown): string {
  const token = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!TOKEN.test(token)) throw new HttpError(400, "token must be an APNs device token");
  return token;
}

/**
 * The phone's token, for the caller. Signed in on it as someone else, the
 * token moves to the caller: a phone gets one person's notifications.
 */
export async function registerDevice(
  db: Db,
  profileId: string,
  token: string,
  lang: "da" | "en",
): Promise<void> {
  const { error } = await db.from("push_devices").upsert({
    token,
    profile_id: profileId,
    lang,
    last_seen_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** The phone's token forgotten (signing out, or notifications switched off). */
export async function unregisterDevice(db: Db, profileId: string, token: string): Promise<void> {
  const { error } = await db
    .from("push_devices")
    .delete()
    .eq("token", token)
    .eq("profile_id", profileId);
  if (error) throw error;
}

interface DeviceRow {
  token: string;
  environment: ApnsEnvironment | null;
}

/**
 * Send one notification to every phone a person said yes on. A phone Apple
 * says the app is gone from is forgotten; the server a token worked on is
 * remembered. Answers how many phones got it.
 */
export async function pushToProfile(
  db: Db,
  profileId: string,
  message: PushMessage,
): Promise<{ sent: number; failed: string[] }> {
  const { data, error } = await db
    .from("push_devices")
    .select("token, environment")
    .eq("profile_id", profileId);
  if (error) throw error;
  const key = apnsKeyFromEnv();
  let sent = 0;
  const failed: string[] = [];
  for (const device of (data ?? []) as DeviceRow[]) {
    const outcome = await deliver(device.token, device.environment, message, key);
    if (outcome.result === "sent") {
      sent++;
      if (outcome.environment !== device.environment) {
        await db
          .from("push_devices")
          .update({ environment: outcome.environment })
          .eq("token", device.token);
      }
    } else if (outcome.result === "gone") {
      await db.from("push_devices").delete().eq("token", device.token);
    } else {
      failed.push(outcome.reason);
      console.warn(`push to a phone of ${profileId} failed: ${outcome.reason}`);
    }
  }
  return { sent, failed };
}
