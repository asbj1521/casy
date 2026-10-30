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

/** One button of the home page's bar (#191), as real glass drawn at its place. */
export interface GlassBarButton {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** SF Symbol names, the first this phone has. */
  symbols: string[];
  iconSize: number;
  title?: string;
  badge?: number;
  /** The icon's and words' colour, r, g, b. */
  tint: [number, number, number];
  badgeTint: [number, number, number];
}

interface GlassPlugin {
  available(): Promise<{ available: boolean }>;
  show(card: GlassCard): Promise<void>;
  hide(): Promise<void>;
  showBar(bar: { items: GlassBarButton[]; visible?: boolean; duration?: number }): Promise<void>;
  setBarVisible(bar: { visible: boolean; duration: number }): Promise<void>;
  pressBar(press: { id: string; down: boolean }): Promise<void>;
  hideBar(): Promise<void>;
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

let availability: Promise<boolean> | null = null;

/** Whether this phone draws real Liquid Glass: the app, on iOS 26 or later. */
export function nativeGlassAvailable(): Promise<boolean> {
  if (!isNativeApp) return Promise.resolve(false);
  availability ??= glassPlugin()
    .then(({ plugin }) => plugin.available())
    .then((answer) => answer.available)
    // An app built before the plugin, or a test's bridge without it.
    .catch(() => false);
  return availability;
}

/** A computed colour, "rgb(234, 88, 12)" or "rgba(...)", as r, g, b; `fallback` for anything else. */
export function parseRgb(
  css: string,
  fallback: [number, number, number],
): [number, number, number] {
  const n = css.match(/[\d.]+/g)?.map(Number) ?? [];
  return n.length >= 3 && n.slice(0, 3).every(Number.isFinite) ? [n[0], n[1], n[2]] : fallback;
}

export async function showGlass(card: GlassCard): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.show(card);
}

export async function hideGlass(): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.hide();
}

/** The home page's bar as real glass (#191): the buttons now on the page, shown or not. */
export async function showGlassBar(
  items: GlassBarButton[],
  visible?: boolean,
  duration?: number,
): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.showBar({ items, visible, duration });
}

export async function setGlassBarVisible(visible: boolean, duration: number): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.setBarVisible({ visible, duration });
}

/** A finger on (or off) a button's web twin: its glass gives under it. */
export async function pressGlassBar(id: string, down: boolean): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.pressBar({ id, down });
}

export async function hideGlassBar(): Promise<void> {
  const { plugin } = await glassPlugin();
  await plugin.hideBar();
}
