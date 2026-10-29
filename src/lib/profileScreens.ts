/**
 * The screens the phone's Profil sheet opens inside itself (#174), by their
 * key in the home page's address (`/?profile=<key>`): the profile's own
 * screens, whose old addresses still lead there. The help pages (Support,
 * How it works, the terms and the privacy policy) stay pages of their own.
 */

/** The sheet's screen for an address, or null for one it doesn't hold. */
export function sheetScreenFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "");
  const profile = /^\/profile\/(settings|password|account|admin|data)$/.exec(path);
  if (profile) return profile[1];
  if (path === "/groups") return "groups";
  const group = /^\/groups\/([^/]+)$/.exec(path);
  return group ? `groups/${group[1]}` : null;
}

/** How deep a screen is: the profile 0, its screens 1, a group 2. */
export function screenDepth(key: string): number {
  if (key === "") return 0;
  return key.startsWith("groups/") ? 2 : 1;
}

/** The screen a screen's way back leads to. */
export function parentScreen(key: string): string {
  return key.startsWith("groups/") ? "groups" : "";
}

/**
 * The home page's address for a sheet screen, keeping what else the link
 * carried (`?password=new` opens the new password form).
 */
export function sheetAddress(key: string, search = ""): string {
  const params = new URLSearchParams(search);
  params.set("profile", key);
  // "profile=" for the profile itself reads as the bare `?profile` key.
  // A group's key keeps its slash readable: "profile=groups/<id>".
  const query = params.toString().replace(/%2F/g, "/");
  return `/?${query.replace(/profile=(&|$)/, "profile$1")}`;
}
