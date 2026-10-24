/** The groups function's invitations and invite links (#160, split out of index.ts). */
import {
  type Invitees,
  looksLikeInviteToken,
  MAX_EMAIL_LOOKUPS_PER_DAY,
  MAX_PICKED_PER_DAY,
} from "../_shared/groups.ts";
import { HttpError } from "../_shared/http.ts";
import { encryptionKeyFromEnv, lookupHash } from "../_shared/secretBox.ts";
import { type Db } from "../_shared/supabaseAdmin.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Everyone the caller shares a group with right now, themself left out. */
export async function knownPeople(db: Db, profileId: string): Promise<Set<string>> {
  const { data: mine, error: mineErr } = await db
    .from("group_members")
    .select("group_id")
    .eq("profile_id", profileId);
  if (mineErr) throw mineErr;
  if (mine.length === 0) return new Set();
  const { data: others, error } = await db
    .from("group_members")
    .select("profile_id")
    .in(
      "group_id",
      mine.map((m) => m.group_id),
    )
    .neq("profile_id", profileId);
  if (error) throw error;
  return new Set(others.map((o) => o.profile_id));
}

/** Who is about to be invited: picked people, and the accounts behind the emails. */
export interface ResolvedInvitees {
  picked: string[];
  byEmail: string[];
}

/**
 * Check the daily limits and work out who the invitees are, before anything
 * is changed (so a refused request makes no group and sends nothing).
 *
 * Picked people must share a group with the caller; anyone else is dropped
 * without a word, since only a doctored request could name them.
 *
 * Email addresses are where care is needed: nothing the caller gets back may
 * say whether an address has an account. So their limit counts every lookup
 * (in group_email_lookups, which stores no address), never the matches, and
 * an address that matches nobody is simply not invited.
 */
export async function resolveInvitees(
  db: Db,
  profileId: string,
  invitees: Invitees,
): Promise<ResolvedInvitees> {
  const since = new Date(Date.now() - DAY_MS).toISOString();

  if (invitees.profileIds.length > 0) {
    const { count, error } = await db
      .from("group_invitations")
      .select("profile_id", { count: "exact", head: true })
      .eq("invited_by", profileId)
      .eq("via_email", false)
      .gt("created_at", since);
    if (error) throw error;
    if ((count ?? 0) + invitees.profileIds.length > MAX_PICKED_PER_DAY) {
      throw new HttpError(429, "You have sent too many invitations today. Try again tomorrow.");
    }
  }

  let byEmail: string[] = [];
  if (invitees.emails.length > 0) {
    const { count, error } = await db
      .from("group_email_lookups")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gt("created_at", since);
    if (error) throw error;
    if ((count ?? 0) + invitees.emails.length > MAX_EMAIL_LOOKUPS_PER_DAY) {
      throw new HttpError(
        429,
        "You have looked up too many email addresses today. Try again tomorrow.",
      );
    }
    // Old rows only ever served yesterday's limit.
    const { error: pruneErr } = await db
      .from("group_email_lookups")
      .delete()
      .eq("profile_id", profileId)
      .lt("created_at", since);
    if (pruneErr) throw pruneErr;
    const { error: logErr } = await db
      .from("group_email_lookups")
      .insert(invitees.emails.map(() => ({ profile_id: profileId })));
    if (logErr) throw logErr;

    const found = await Promise.all(
      invitees.emails.map(async (email) => {
        const { data, error: findErr } = await db.rpc("find_user_by_email", { p_email: email });
        if (findErr) throw findErr;
        return data as string | null;
      }),
    );
    byEmail = found.filter((id): id is string => !!id && id !== profileId);
  }

  const known = invitees.profileIds.length > 0 ? await knownPeople(db, profileId) : new Set();
  return { picked: invitees.profileIds.filter((id) => known.has(id)), byEmail };
}

/** Send the invitations; who was skipped (already in, already invited) is never said. */
export async function sendInvites(
  db: Db,
  groupId: string,
  profileId: string,
  { picked, byEmail }: ResolvedInvitees,
): Promise<void> {
  for (const [ids, viaEmail] of [
    [picked, false],
    [byEmail, true],
  ] as const) {
    if (ids.length === 0) continue;
    const { error } = await db.rpc("send_group_invitations", {
      p_group_id: groupId,
      p_inviter: profileId,
      p_profile_ids: ids,
      p_via_email: viaEmail,
    });
    if (error) throw error;
  }
}

/** The caller's open invitations: which group, who asked, how many are in it already. */
export async function listInvitations(db: Db, profileId: string) {
  const { data: rows, error } = await db
    .from("group_invitations")
    .select("group_id, invited_by, created_at, friend_groups!inner(name, description)")
    .eq("profile_id", profileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return [];

  const groupIds = rows.map((r) => r.group_id);
  const inviterIds = [...new Set(rows.map((r) => r.invited_by).filter((id) => id !== null))];
  const [members, inviters] = await Promise.all([
    db.from("group_members").select("group_id").in("group_id", groupIds),
    db.from("profiles").select("id, display_name").in("id", inviterIds),
  ]);
  if (members.error) throw members.error;
  if (inviters.error) throw inviters.error;
  const memberCount = new Map<string, number>();
  for (const m of members.data) memberCount.set(m.group_id, (memberCount.get(m.group_id) ?? 0) + 1);
  const nameOf = new Map(inviters.data.map((p) => [p.id, p.display_name]));

  return rows.map((r) => ({
    groupId: r.group_id,
    // A to-one embed, which the untyped client takes for a list.
    groupName: (r.friend_groups as unknown as { name: string }).name,
    groupDescription:
      (r.friend_groups as unknown as { description: string | null }).description ?? null,
    memberCount: memberCount.get(r.group_id) ?? 0,
    // Null once the inviter's account is gone; the invitation still stands.
    invitedBy: r.invited_by ? (nameOf.get(r.invited_by) ?? null) : null,
    createdAt: r.created_at,
  }));
}

/** The live invite behind a link, with its group; refused if it never was one or has expired. */
export async function findInvite(db: Db, token: unknown) {
  if (!looksLikeInviteToken(token)) throw new HttpError(400, "That invite link is not valid.");
  const { data: invite, error } = await db
    .from("group_invites")
    .select("group_id, expires_at, friend_groups!inner(name, description)")
    .eq("token_hash", await lookupHash(token, encryptionKeyFromEnv()))
    .maybeSingle();
  if (error) throw error;
  if (!invite) throw new HttpError(404, "That invite link is not valid.");
  if (Date.parse(invite.expires_at) <= Date.now()) {
    throw new HttpError(410, "That invite link has expired. Ask for a new one.");
  }
  // A to-one embed, which the untyped client takes for a list.
  const group = invite.friend_groups as unknown as { name: string; description: string | null };
  return {
    groupId: invite.group_id as string,
    groupName: group.name,
    groupDescription: group.description ?? null,
  };
}
