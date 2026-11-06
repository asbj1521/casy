import { readStored, writeStored } from "@/lib/storage";

const sentKey = (userId: string, groupId: string) => `casy-invite-sent:${userId}:${groupId}`;

/**
 * This person has invited someone to this group, in a way the server may not
 * tell them about: an email, a link, a text (#147). Kept on this device.
 */
export function rememberInviteSent(userId: string, groupId: string): void {
  writeStored(sentKey(userId, groupId), "1");
}

export function inviteWasSent(userId: string, groupId: string): boolean {
  return readStored(sentKey(userId, groupId)) === "1";
}

/** What the person's own group is, as far as the nudge cares. */
interface NudgeGroup {
  id: string;
  name: string;
  members: unknown[];
  /** People invited who haven't answered, as far as you may know. */
  invited: unknown[];
}

export type GroupNudge = { kind: "new" } | { kind: "invite"; group: { id: string; name: string } };

/**
 * What the home page nudges a newcomer towards (#210), since Casy does
 * nothing until someone else is in: no group, make one; alone in all of them,
 * invite someone to the first. Nothing until the answers are in, while an
 * invitation of theirs waits (their way in is already there), once anyone has
 * joined a group of theirs, or once someone has been invited to one (#147).
 */
export function groupNudge(
  groups: readonly NudgeGroup[] | undefined,
  invitations: readonly unknown[] | undefined,
  /** Whether this device has invited someone to the group (inviteWasSent). */
  sent: (groupId: string) => boolean = () => false,
): GroupNudge | null {
  if (!groups || !invitations || invitations.length > 0) return null;
  if (groups.length === 0) return { kind: "new" };
  if (groups.some((g) => g.members.length > 1 || g.invited.length > 0 || sent(g.id))) return null;
  const { id, name } = groups[0];
  return { kind: "invite", group: { id, name } };
}
