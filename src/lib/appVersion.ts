/**
 * Which release this build is, and whether it is too old to use (#143).
 *
 * The iPhone app carries its own copy of the site, so once a version is in
 * people's hands it stays there until they update. Casy names the oldest
 * release it still works with (the `app-version` function, set by the
 * operator with a function secret); an app older than that shows "Update
 * Casy" instead of breaking in odd ways. The website is always the latest,
 * so it never asks.
 */

/** This build's release (package.json's version, stamped by vite.config.ts). */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "0.0.0";

/** "1.2.3" as [1, 2, 3]; null for anything else. */
export function parseVersion(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null;
}

/**
 * True when `current` is older than `minimum`. Anything unreadable on either
 * side counts as new enough: a typo in the secret must never lock everyone out.
 */
export function isOutdated(current: string, minimum: string | null): boolean {
  if (!minimum) return false;
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
