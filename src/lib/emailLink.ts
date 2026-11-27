/**
 * A one-time link from one of our auth emails (#202): `/sign-in?token_hash=…&type=…`,
 * which the page checks itself (verifyOtp) instead of Auth's verify endpoint
 * doing it and redirecting here. On an iPhone with the app, casy.app hands these
 * addresses to the app, which does the same; everywhere else this page does.
 */

const TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
export type EmailLinkType = (typeof TYPES)[number];

/** The link's token in this address's query, or null when it carries none. */
export function emailLinkIn(search: string): { tokenHash: string; type: EmailLinkType } | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash || !type || !(TYPES as readonly string[]).includes(type)) return null;
  return { tokenHash, type: type as EmailLinkType };
}

/**
 * The address once the link has been used: the token gone, the rest kept (its
 * language, where to go next), and, when it failed, the reason where the
 * sign-in page reads a failed link's (`error_description`).
 */
export function addressAfterLink(href: string, error?: string): string {
  const url = new URL(href);
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  if (error) url.searchParams.set("error_description", error);
  return url.pathname + url.search + url.hash;
}
