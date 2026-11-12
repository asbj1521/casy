/**
 * The app's name as people see it (#267, #268). Casy is being renamed "Vi
 * finder lige en dag"; until launch day (#272) both settings still say Casy,
 * and launch day changes them here, in `_shared/brand.ts` and in the native
 * String Catalog together. Everything else speaks as "vi" and needs no name.
 * Code names, the domain and every stored id keep "casy" for good.
 */

/** The full name: link previews, emails, the version line, notes in calendars. */
export const APP_NAME = "Casy";

/**
 * The name iOS shows under the icon, in Settings and above notifications
 * (`CFBundleDisplayName`): any line that sends someone to iPhone's Settings
 * names the app by this.
 */
export const APP_LABEL = "Casy";
