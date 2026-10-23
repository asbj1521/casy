/**
 * The oldest iPhone app release Casy still works with, and where to get a newer
 * one (#143), from the function secrets `MIN_APP_VERSION` and `APP_STORE_URL`.
 * Setting either takes effect at once, without a deploy. Anything malformed is
 * left out rather than passed on: a typo must never lock everyone out (the app
 * also treats an unreadable minimum as none, src/lib/appVersion.ts).
 */
export interface AppVersionInfo {
  minVersion: string | null;
  storeUrl: string | null;
}

const VERSION = /^\d+\.\d+(?:\.\d+)?$/;

export function appVersionInfo(minVersion?: string, storeUrl?: string): AppVersionInfo {
  const min = minVersion?.trim() ?? "";
  const url = storeUrl?.trim() ?? "";
  return {
    minVersion: VERSION.test(min) ? min : null,
    storeUrl: /^https:\/\/apps\.apple\.com\//.test(url) ? url : null,
  };
}
