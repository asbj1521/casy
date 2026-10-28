/**
 * Which websites the OAuth callbacks may send the browser back to.
 *
 * The site runs in more than one place (the live site and localhost during
 * development), and after connecting Google or Outlook the person should land
 * back on the one they started from. That origin travels through the signed
 * OAuth state, but it is still checked against this allowlist: otherwise a
 * crafted connect request could bounce people to a look-alike site straight
 * after they grant access.
 *
 * Configured with FRONTEND_ORIGINS, a comma-separated list whose first entry
 * is the default; FRONTEND_URL (a single origin) still works as before.
 */

const FALLBACK = "http://localhost:8080";

/** Normalise to a bare origin ("https://casy.example"), or null if it isn't a URL. */
function originOf(value: string): string | null {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

/** The allowed origins, default first. */
export function allowedFrontends(): string[] {
  const configured = Deno.env.get("FRONTEND_ORIGINS") ?? Deno.env.get("FRONTEND_URL") ?? FALLBACK;
  const list = configured
    .split(",")
    .map(originOf)
    .filter((o): o is string => o !== null);
  return list.length > 0 ? list : [FALLBACK];
}

/**
 * The site an invite link points to. From the iPhone app (`fromApp`) always
 * the default one, whatever it is served from: with live reload (npm run
 * ios:live) the app's page is the dev server on localhost, a link no one
 * else's phone can open. From the website, the address the person is on, so
 * an invite made on a preview or localhost opens there too.
 */
export function inviteFrontend(
  origin: string | null | undefined,
  fromApp: boolean,
  allowed: string[],
): string {
  return fromApp ? allowed[0] : pickFrontend(origin, allowed);
}

/** `candidate` if it is an allowed origin, otherwise the default one. */
export function pickFrontend(candidate: string | null | undefined, allowed: string[]): string {
  const origin = candidate ? originOf(candidate) : null;
  return origin && allowed.includes(origin) ? origin : allowed[0];
}
