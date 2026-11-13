/**
 * Links that open the iPhone app (#140): iOS hands the app the URL of a
 * casy.app link it was opened from, and this says where in the app it leads.
 * Only an invite link, `/join/<token>`, or a friend link, `/friend/<token>`
 * (#226), on casy.app itself or on the door (below), which is also all the
 * association file lists (public/.well-known/apple-app-site-association):
 * anything else is ignored, so a link can never take the app to a page, or
 * to another site, it didn't promise.
 *
 * The door (#257). iOS decides by itself whether a tapped link opens the app,
 * and often doesn't: a chat app's own browser never hands links on, and once
 * someone is on casy.app in Safari, a casy.app link stays in Safari, since iOS
 * only leaves a site for an app on a tap that leads to ANOTHER site. So the
 * invite page offers "Åbn i Casy-appen", which leads to the same invite on a
 * second address the app answers to (APP_DOOR_HOST, the site's older address,
 * which serves the same build and association file):
 *
 * - an app that knows the door (its entitlement lists it) opens at once;
 * - otherwise the browser loads the door page (`?door`), whose one button
 *   leads back to casy.app (`?noapp`): another site again, so an app that
 *   knows only casy.app (releases before the door) opens on that tap;
 * - with no app, or in a browser that hands nothing on, that tap just loads
 *   the invite page, which then says what to do (`?noapp`).
 */

/** The site whose links open the app. */
export const APP_LINK_HOST = "casy.app";
/** The second address the app answers to: the door from casy.app into the app. */
export const APP_DOOR_HOST = "casy-red.vercel.app";

const HOSTS: readonly string[] = [APP_LINK_HOST, APP_DOOR_HOST];

/** The in-app path a URL leads to, or null when it isn't a link the app opens. */
export function appLinkPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !HOSTS.includes(parsed.hostname)) return null;
  // The computer's QR code (#270): an iPhone that has the app opens it on its home page.
  if (/^\/app\/?$/.test(parsed.pathname)) return "/";
  const link = /^\/(join|friend)\/([^/]+)\/?$/.exec(parsed.pathname);
  return link ? `/${link[1]}/${link[2]}` : null;
}

/** An invite's own address, as it is sent: what "Hent appen" copies (#237). */
export function inviteLinkUrl(path: string): string {
  return `https://${APP_LINK_HOST}${path}`;
}

/** From the invite page on casy.app to the door: opens an app that knows the door. */
export function doorUrl(path: string): string {
  return `https://${APP_DOOR_HOST}${path}?door=1`;
}

/** From the door page back to casy.app: opens any app, else the invite page, told so. */
export function fromDoorUrl(path: string): string {
  return `https://${APP_LINK_HOST}${path}?noapp=1`;
}

/**
 * The invite in a pasted text (#237), as the in-app path it leads to: the
 * link alone, or among other words ("Kom med: https://casy.app/join/…!"), as
 * a chat copies it. Null when there is none.
 */
export function inviteInText(text: string): string | null {
  for (const [found] of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
    // A sentence's end is not the link's.
    const path = appLinkPath(found.replace(/[.,;:!?)\]]+$/, ""));
    if (path) return path;
  }
  return null;
}

/**
 * A chat or social app's own browser (Messenger, Instagram and the like), by
 * the name it adds to the browser's: it hands no link on to another app, so
 * there the way into Casy is to open the page in Safari first (#257).
 */
export function inAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|Snapchat|TikTok|musical_ly|LinkedInApp|Line\//i.test(
    userAgent,
  );
}
