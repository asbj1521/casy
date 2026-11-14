/**
 * The app's name as people see it (#267, #268). Casy is being renamed "Vi
 * finder lige en dag". This branch merges on launch day (#272), so the name is
 * already the new one here; the label follows with the renamed app (#271),
 * changed here, in `_shared/brand.ts` and in the native
 * String Catalog together. Everything else speaks as "vi" and needs no name.
 * Code names, the domain and every stored id keep "casy" for good.
 */

/** The full name: link previews, emails, the version line, notes in calendars. */
export const APP_NAME = "Vi finder lige en dag";

/**
 * The name iOS shows under the icon, in Settings and above notifications
 * (`CFBundleDisplayName`): any line that sends someone to iPhone's Settings
 * names the app by this.
 */
export const APP_LABEL = "Find en dag";

/**
 * The English name, tried on a branch (try/english-name): the English pages
 * and the English logo say it; Danish keeps "Vi finder lige en dag".
 */
export const APP_NAME_EN = "OMG, let's find a date";

/** The name in a language: the one thing that reads the language from brand.ts. */
export function appName(lang: "da" | "en"): string {
  return lang === "en" ? APP_NAME_EN : APP_NAME;
}
