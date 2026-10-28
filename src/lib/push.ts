/**
 * Push notifications in the iPhone app (#139), through Capacitor's push
 * plugin: iOS's permission, the phone's APNs token (sent to Casy's server,
 * which is the only one that sends), and a tap on a notification opening the
 * screen it is about. The website never loads it (isNativeApp); when to ask
 * is pushAsk.ts, and what is sent is decided on the server.
 *
 * As in phoneCalendar.ts, the plugin's module loads on first use and only the
 * module goes through promises.
 */
import { registerPushToken, unregisterPushToken } from "@/api/account";
import type { Lang } from "@/i18n/locale";
import type { PushPermission } from "@/lib/pushAsk";
import { readStored, writeStored } from "@/lib/storage";

/** The token of this phone as last registered, to take it back on signing out. */
const TOKEN_KEY = "casy-push-token";

async function pushPlugin() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  return { plugin: PushNotifications };
}

/** What iOS says about notifications for Casy right now. */
export async function pushPermission(): Promise<PushPermission> {
  const { plugin } = await pushPlugin();
  const { receive } = await plugin.checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
}

/** How long to wait for iOS to hand over the phone's token. */
const TOKEN_TIMEOUT_MS = 15_000;

/** The phone's token from iOS, and with it registered with Casy's server. */
async function register(lang: Lang): Promise<void> {
  const { plugin } = await pushPlugin();
  let gotToken: (token: string) => void = () => {};
  let failed: (err: Error) => void = () => {};
  const answer = new Promise<string>((resolve, reject) => {
    gotToken = resolve;
    failed = reject;
  });
  const handles = await Promise.all([
    plugin.addListener("registration", (t) => gotToken(t.value)),
    plugin.addListener("registrationError", (e) => failed(new Error(e.error))),
  ]);
  const timer = setTimeout(() => failed(new Error("iOS gave no token")), TOKEN_TIMEOUT_MS);
  try {
    await plugin.register();
    const token = await answer;
    await registerPushToken(token, lang);
    writeStored(TOKEN_KEY, token);
  } finally {
    clearTimeout(timer);
    for (const handle of handles) void handle.remove();
  }
}

/**
 * Ask iOS (its own prompt, shown once ever; after that the answer stands),
 * and with a yes, register the phone with Casy's server. Answers iOS's answer.
 */
export async function enablePush(lang: Lang): Promise<"granted" | "denied"> {
  const { plugin } = await pushPlugin();
  const asked = await plugin.requestPermissions();
  if (asked.receive !== "granted") return "denied";
  await register(lang);
  return "granted";
}

/**
 * On opening the app signed in: when notifications are already allowed, the
 * phone registers again, as its token can change and the account may not be
 * the one it was last registered for.
 */
export async function refreshPush(lang: Lang): Promise<void> {
  if ((await pushPermission()) === "granted") await register(lang);
}

/** A tap on a notification: where in the app it leads (a path), through `open`. */
export async function onNotificationTap(open: (path: string) => void): Promise<() => void> {
  const { plugin } = await pushPlugin();
  const handle = await plugin.addListener("pushNotificationActionPerformed", (action) => {
    const url = action.notification.data?.url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) open(url);
  });
  return () => void handle.remove();
}

/**
 * Signing out: this phone's token is taken back from the account first, while
 * it can still be, so the next person on it never gets this one's
 * notifications. Never stops the sign-out.
 */
export async function forgetPush(): Promise<void> {
  const token = readStored(TOKEN_KEY);
  if (!token) return;
  try {
    await unregisterPushToken(token);
    writeStored(TOKEN_KEY, null);
  } catch {
    // Offline: the server forgets it itself when Apple says the app is gone,
    // and the next sign-in on this phone moves it.
  }
}
