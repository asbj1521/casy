/**
 * Apple's own Liquid Glass for one card on the page (#151), through the app's
 * Glass plugin (GlassPlugin.swift, iOS 26 and later): a real glass view laid
 * over the web view, refracting the page under it, which no CSS can do in a
 * web view. The page keeps the card's place and says where it is; elsewhere
 * (the website, older iPhones) the page draws its own CSS glass instead.
 *
 * As in phoneCalendar.ts, @capacitor/core loads on first use and only the
 * module goes through promises, never the plugin itself.
 */
import { isNativeApp } from "@/lib/nativeApp";

interface GlassCard {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  number: string;
  text: string;
  /** The badge's colour, r, g, b. */
  accent: [number, number, number];
}

interface GlassPlugin {
  available(): Promise<{ available: boolean }>;
  show(card: GlassCard): Promise<void>;
  hide(): Promise<void>;
}

let plugin: GlassPlugin | null = null;

async function glassPlugin(): Promise<{ plugin: GlassPlugin }> {
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<GlassPlugin>("Glass");
  }
  // Wrapped: resolving a promise with the plugin itself would never settle.
  return { plugin };
}

/** Whether this phone draws real Liquid Glass: the app, on iOS 26 or later. */
export async function nativeGlassAvailable(): Promise<boolean> {
  if (!isNativeApp) return false;
  try {
    const { plugin } = await glassPlugin();
    return (await plugin.available()).available;
  } catch {
    // An app built before the plugin, or a test's bridge without it.
    return false;
  }
}

export async function showGlass(card: GlassCard): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.show(card);
}

export async function hideGlass(): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.hide();
}
