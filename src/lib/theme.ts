/**
 * Light or dark (#93). The iPhone app always follows the phone. The website
 * follows the system too unless the profile's "Udseende" forced light or
 * dark, remembered per device like the language (`casy-theme`).
 *
 * Following the system needs no JavaScript at all (src/theme.css), so the
 * page is drawn in the right theme from the first frame; a forced theme is a
 * class on <html>, set before the first render (main.tsx).
 */
import { readStored, writeStored } from "@/lib/storage";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "casy-theme";

/** The page backgrounds (--background in index.css and theme.css), for the browser's own bars. */
const BAR_COLOR = { light: "#faf8f5", dark: "#0c0c0e" } as const;

/** A stored value as a choice: "system" for nothing (or nonsense), and always in the app. */
export function themeFrom(stored: string | null, nativeApp: boolean): ThemeChoice {
  if (nativeApp) return "system";
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** What was chosen on this device. */
export function storedTheme(nativeApp: boolean): ThemeChoice {
  return themeFrom(readStored(THEME_KEY), nativeApp);
}

/** The class <html> carries for a choice: none when following the system. */
export function themeClass(choice: ThemeChoice): string | null {
  return choice === "system" ? null : `theme-${choice}`;
}

/**
 * Put a choice into effect: the class on <html>, and the colour Safari tints
 * its bars with (index.html has one per system theme; forced, both say the
 * forced one).
 */
export function applyTheme(
  choice: ThemeChoice,
  root: Pick<HTMLElement, "classList"> = document.documentElement,
  metas: Iterable<
    Pick<HTMLMetaElement, "media" | "content">
  > = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
) {
  root.classList.remove("theme-light", "theme-dark");
  const cls = themeClass(choice);
  if (cls) root.classList.add(cls);
  for (const meta of metas) {
    const own = meta.media.includes("dark") ? "dark" : "light";
    meta.content = BAR_COLOR[choice === "system" ? own : choice];
  }
}

/** Sent when the profile changes the theme, for what draws colours in code (useIsDark). */
export const THEME_CHANGE = "casy-theme-change";

/** Remember a choice made on the profile, and put it into effect. */
export function chooseTheme(choice: ThemeChoice): void {
  writeStored(THEME_KEY, choice === "system" ? null : choice);
  applyTheme(choice);
  window.dispatchEvent(new Event(THEME_CHANGE));
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Whether the page is dark right now: a forced theme, else the system's. */
export function isDarkNow(): boolean {
  const classes = document.documentElement.classList;
  if (classes.contains("theme-dark")) return true;
  if (classes.contains("theme-light")) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/** Calls `onChange` when that may have changed: the system switched, or the profile did. */
export function onThemeChange(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  window.addEventListener(THEME_CHANGE, onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener(THEME_CHANGE, onChange);
  };
}
