/**
 * The bridge to the iPhone app's native screens (NativeBridgePlugin in ios/,
 * #192, #196). Until the home page is native, the page keeps the login, the
 * language and the theme, and tells the app each time they change; a native
 * screen that changes a choice tells the page, which applies it as its own
 * rows do. The app's only; the website never calls it (see isNativeApp).
 *
 * As in phoneCalendar.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin (it answers to `then` too).
 */
import type { PluginListenerHandle } from "@capacitor/core";

import type { Lang } from "@/i18n/locale";
import { isNativeApp } from "@/lib/nativeApp";
import type { ThemeChoice } from "@/lib/theme";

/** A screen the app may draw natively in place of the page's own. */
export type NativeScreen = "settings";

interface Preferences {
  lang: Lang;
  theme: ThemeChoice;
}

interface NativeBridgePlugin {
  screens(): Promise<{ screens: string[] }>;
  setSession(options: {
    functionsUrl: string;
    apiKey: string;
    session: { accessToken: string; expiresAt: number; userId: string } | null;
  }): Promise<void>;
  setPreferences(options: Preferences): Promise<void>;
  open(options: { screen: NativeScreen }): Promise<void>;
  addListener(
    event: "preferences",
    listener: (choice: Preferences) => void,
  ): Promise<PluginListenerHandle>;
}

let plugin: NativeBridgePlugin | null = null;

async function bridgePlugin(): Promise<{ plugin: NativeBridgePlugin }> {
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<NativeBridgePlugin>("NativeBridge");
  }
  return { plugin };
}

let screens: Promise<ReadonlySet<string>> | null = null;

/**
 * The screens this build of the app draws natively, asked once. None on the
 * website, or from an app without the bridge (`npm run ios:live` against an
 * older build).
 */
export function nativeScreens(): Promise<ReadonlySet<string>> {
  if (!isNativeApp) return Promise.resolve(new Set());
  screens ??= bridgePlugin()
    .then(({ plugin }) => plugin.screens())
    .then((answer) => new Set(answer.screens))
    .catch(() => new Set());
  return screens;
}

/** Show a native screen over the page. */
export async function openNativeScreen(screen: NativeScreen): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.open({ screen });
}

/** Where the Edge Functions are (as supabaseFunctions.ts builds it). */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Lend the app the login (null when signed out). Only the access token goes:
 * the page keeps refreshing it and sends each new one.
 */
export async function lendSession(
  session: { accessToken: string; expiresAt: number; userId: string } | null,
): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setSession({
    functionsUrl: FUNCTIONS_URL,
    apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    session,
  });
}

/** Tell the app the language and theme the page uses now. */
export async function sharePreferences(preferences: Preferences): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setPreferences(preferences);
}

/** Calls `onChoose` when a native screen changes the language or theme. */
export async function onNativeChoice(
  onChoose: (choice: Preferences) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("preferences", onChoose);
}
