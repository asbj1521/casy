/** What the person's own group is, as far as the nudge cares. */
interface NudgeGroup {
  id: string;
  name: string;
  members: unknown[];
}

export type GroupNudge = { kind: "new" } | { kind: "invite"; group: { id: string; name: string } };

/**
 * What the home page nudges a newcomer towards (#210), since Casy does
 * nothing until someone else is in: no group, make one; alone in all of them,
 * invite someone to the first. Nothing until the answers are in, while an
 * invitation of theirs waits (their way in is already there), or once anyone
 * has joined a group of theirs.
 */
export function groupNudge(
  groups: readonly NudgeGroup[] | undefined,
  invitations: readonly unknown[] | undefined,
): GroupNudge | null {
  if (!groups || !invitations || invitations.length > 0) return null;
  if (groups.length === 0) return { kind: "new" };
  if (groups.some((g) => g.members.length > 1)) return null;
  const { id, name } = groups[0];
  return { kind: "invite", group: { id, name } };
}
