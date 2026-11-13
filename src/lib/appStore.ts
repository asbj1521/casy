/** The app's page in the App Store (#147). */
export const APP_STORE_URL = "https://apps.apple.com/app/id6830713238";

/** Whether this is an iPhone (or iPod) browsing the website, the ones the App Store link is for. */
export function isIphoneBrowser(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}
