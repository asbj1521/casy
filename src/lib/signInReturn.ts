/**
 * Where to send someone back to after signing in, when a page that needs a
 * login finds them signed out (RequireAuth), or null for the sign-in page's
 * own choice (the scheduler).
 *
 * A group, an event or an invite is somewhere a person was heading, so they
 * return to it. The profile is somewhere they were sitting: a session that
 * ends there (signing out, or a login that expired in an open tab or the
 * app) would otherwise make every later sign-in land on the profile (#97).
 * Your data is the exception, since the privacy policy links to it for
 * readers who may not be signed in yet.
 */
export function returnPathAfterSignIn(path: string): string | null {
  const pathname = path.split(/[?#]/)[0];
  const onProfile = pathname === "/profile" || pathname.startsWith("/profile/");
  return onProfile && pathname !== "/profile/data" ? null : path;
}
