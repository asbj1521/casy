/**
 * The small rules about groups the browser needs to know too.
 *
 * The database and the `groups` Edge Function are what actually enforce these
 * (supabase/migrations/…_friend_groups.sql and _shared/groups.ts). The copies
 * here exist so a form can stop someone typing a 200-character name before
 * the round trip, not as the rule itself.
 */

/** Longest group name that will be stored. */
export const MAX_GROUP_NAME_LENGTH = 60;

/** Longest custom display name that will be stored. */
export const MAX_DISPLAY_NAME_LENGTH = 40;

/** Most email addresses one invitation may carry (the groups function's own limit). */
export const MAX_EMAILS_PER_INVITE = 10;

/** Someone you share at least one group with, and which groups those are. */
export interface KnownPerson {
  profileId: string;
  name: string;
  groupNames: string[];
}

/**
 * Everyone you're in a group with, to invite somewhere new: you left out, and
 * so is anyone already in `except` (the group being invited to). Sorted by
 * name, so the list reads the same every time it opens.
 */
export function knownPeople(
  groups: {
    id: string;
    name: string;
    members: { profileId: string; name: string; isYou: boolean }[];
  }[],
  except?: string,
): KnownPerson[] {
  const inExcept = new Set(
    groups.find((g) => g.id === except)?.members.map((m) => m.profileId) ?? [],
  );
  const people = new Map<string, KnownPerson>();
  for (const g of groups) {
    for (const m of g.members) {
      if (m.isYou || inExcept.has(m.profileId)) continue;
      const person = people.get(m.profileId);
      if (person) person.groupNames.push(g.name);
      else people.set(m.profileId, { profileId: m.profileId, name: m.name, groupNames: [g.name] });
    }
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Shaped like an email address: enough to catch a typo before asking the server. */
export function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

/** The words for "7 days", "3 hours" and so on, from the page's dictionary. */
export interface InviteExpiryWords {
  expired: string;
  days: (n: number) => string;
  hours: (n: number) => string;
  underAnHour: string;
}

/**
 * How long is left on an invite link, in words: "7 days", "6 hours", or
 * "soon" for the last stretch. Whole units only, because an invite is
 * something you glance at before pasting it into a chat, not a countdown.
 */
export function inviteExpiryLabel(
  expiresAt: string,
  words: InviteExpiryWords,
  now = Date.now(),
): string {
  const left = Date.parse(expiresAt) - now;
  if (!Number.isFinite(left) || left <= 0) return words.expired;
  const days = Math.floor(left / 86_400_000);
  if (days >= 1) return words.days(days);
  const hours = Math.floor(left / 3_600_000);
  if (hours >= 1) return words.hours(hours);
  return words.underAnHour;
}
