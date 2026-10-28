/**
 * Push notifications in the iPhone app (#139), through Capacitor's push
 * plugin: iOS's permission, the phone's APNs token (sent to Casy's server,
 * which is the only one that sends), and a tap on a notification opening the
 * screen it is about. The website never loads it (isNativeApp).
 *
 * As in phoneCalendar.ts, the plugin's module loads on first use and only the
 * module goes through promises.
 */
import { registerPushToken } from "@/api/account";
import type { Lang } from "@/i18n/locale";

async function pushPlugin() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  return { plugin: PushNotifications };
}

/**
 * Ask iOS (its own prompt, shown once ever; after that the answer stands),
 * and with a yes, register the phone with Casy's server. Answers iOS's answer.
 */
export async function enablePush(lang: Lang): Promise<"granted" | "denied"> {
  const { plugin } = await pushPlugin();
  const asked = await plugin.requestPermissions();
  if (asked.receive !== "granted") return "denied";
  const token = await new Promise<string>((resolve, reject) => {
    void plugin.addListener("registration", (t) => resolve(t.value));
    void plugin.addListener("registrationError", (e) => reject(new Error(e.error)));
    void plugin.register();
  });
  await registerPushToken(token, lang);
  return "granted";
}
