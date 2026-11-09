/**
 * The bridge to the iPhone app's native screens (NativeBridgePlugin in ios/,
 * #192, #198). Until the home page is native, the page keeps the login, the
 * language and the theme, and tells the app each time they change; a native
 * screen that changes a choice tells the page, which applies it as its own
 * rows do. The app's only; the website never calls it (see isNativeApp).
 *
 * As in phoneCalendar.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin (it answers to `then` too).
 */
import type { PluginListenerHandle } from "@capacitor/core";

import type { Lang } from "@/i18n/locale";
import { APP_BUILD } from "@/lib/feedback";
import { isNativeApp } from "@/lib/nativeApp";
import type { ThemeChoice } from "@/lib/theme";

/** A screen the app may draw natively in place of the page's own. */
export type NativeScreen = "settings" | "profile";

interface LentSession {
  accessToken: string;
  expiresAt: number;
  userId: string;
  email?: string;
}

/** A native screen has closed, and what the page should do about it. */
export interface NativeClosed {
  screen: NativeScreen;
  /** An address in the page: the screen handed over to the page's own. */
  next?: string;
  signOut?: boolean;
}

interface Preferences {
  lang: Lang;
  theme: ThemeChoice;
}

interface NativeBridgePlugin {
  screens(): Promise<{ screens: string[] }>;
  setSession(options: {
    projectUrl: string;
    apiKey: string;
    session: LentSession | null;
  }): Promise<void>;
  setPreferences(options: Preferences): Promise<void>;
  open(options: { screen: NativeScreen; build: string; userAgent: string }): Promise<void>;
  pushResult(options: { answer: "granted" | "denied" | "failed" }): Promise<void>;
  addListener(
    event: "preferences",
    listener: (choice: Preferences) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "closed",
    listener: (closed: NativeClosed) => void,
  ): Promise<PluginListenerHandle>;
  addListener(event: "needSession", listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: "dataChanged", listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: "enablePush", listener: () => void): Promise<PluginListenerHandle>;
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
  await plugin.open({ screen, build: APP_BUILD, userAgent: navigator.userAgent });
}

/**
 * Lend the app the login (null when signed out). Only the access token goes:
 * the page keeps refreshing it and sends each new one.
 */
export async function lendSession(session: LentSession | null): Promise<void> {
  const { plugin } = await bridgePlugin();
  await plugin.setSession({
    projectUrl: import.meta.env.VITE_SUPABASE_URL,
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

/** Calls `onClose` when a native screen has closed. */
export async function onNativeClosed(
  onClose: (closed: NativeClosed) => void,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("closed", onClose);
}

/** Calls `onChange` when a native screen changed your name or picture. */
export async function onNativeDataChanged(onChange: () => void): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("dataChanged", onChange);
}

/** Calls `onNeed` when a native screen's login has run out, so the page refreshes it. */
export async function onNeedSession(onNeed: () => void): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("needSession", onNeed);
}

/**
 * Calls `enable` when a native screen asks to turn notifications on, and tells
 * it how that went. The page does it: the phone's token reaches only the page.
 */
export async function onEnablePush(
  enable: () => Promise<"granted" | "denied">,
): Promise<PluginListenerHandle> {
  const { plugin } = await bridgePlugin();
  return plugin.addListener("enablePush", () => {
    void enable()
      .catch(() => "failed" as const)
      .then((answer) => plugin.pushResult({ answer }));
  });
}
