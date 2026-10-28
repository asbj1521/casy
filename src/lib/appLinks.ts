/**
 * Links that open the iPhone app (#140): iOS hands the app the URL of a
 * casy.app link it was opened from, and this says where in the app it leads.
 * Only an invite link, `/join/<token>` on casy.app itself, which is also all
 * the association file lists (public/.well-known/apple-app-site-association):
 * anything else is ignored, so a link can never take the app to a page, or
 * to another site, it didn't promise.
 */

/** The site whose links open the app. */
export const APP_LINK_HOST = "casy.app";

/** The in-app path a URL leads to, or null when it isn't a link the app opens. */
export function appLinkPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== APP_LINK_HOST) return null;
  const token = /^\/join\/([^/]+)\/?$/.exec(parsed.pathname)?.[1];
  return token ? `/join/${token}` : null;
}
