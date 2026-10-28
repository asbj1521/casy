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

/** The kinds a person can switch (push_settings, the push_notifications migration). */
export const PUSH_KINDS = [
  "vote_invited",
  "vote_decided",
  "event_changed",
  "group_invitation",
  "deadline_near",
] as const;
export type PushKindName = (typeof PUSH_KINDS)[number];

/** Which kinds are switched off for the person, and how many phones notifications go to. */
export async function readPushSettings(
  db: Db,
  profileId: string,
): Promise<{ off: string[]; devices: number }> {
  const [settings, devices] = await Promise.all([
    db.from("push_settings").select("off").eq("profile_id", profileId).maybeSingle(),
    db
      .from("push_devices")
      .select("token", { count: "exact", head: true })
      .eq("profile_id", profileId),
  ]);
  if (settings.error) throw settings.error;
  if (devices.error) throw devices.error;
  return { off: (settings.data?.off as string[] | undefined) ?? [], devices: devices.count ?? 0 };
}

/** One kind switched on or off; the rest stay as they were. */
export async function setPushKind(
  db: Db,
  profileId: string,
  kind: unknown,
  on: unknown,
): Promise<string[]> {
  if (typeof on !== "boolean") throw new HttpError(400, "on must be true or false");
  if (!PUSH_KINDS.includes(kind as PushKindName)) throw new HttpError(400, "Unknown kind");
  const { off } = await readPushSettings(db, profileId);
  const next = on ? off.filter((k) => k !== kind) : [...new Set([...off, kind as string])];
  const { error } = await db
    .from("push_settings")
    .upsert({ profile_id: profileId, off: next, updated_at: new Date().toISOString() });
  if (error) throw error;
  return next;
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
