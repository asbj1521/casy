/**
 * Friends (#222): people you have shared a group with, who stay invitable
 * after that group is gone, and anyone who said yes to your friend link (#226).
 * A trigger on group_members fills the table for groups. It stays an
 * invitation: joining takes their own yes, and blocking always wins.
 */
import { INVITE_LIFETIME_MS, looksLikeInviteToken, newInviteToken } from "../_shared/groups.ts";
import { HttpError } from "../_shared/http.ts";
import { encryptionKeyFromEnv, lookupHash } from "../_shared/secretBox.ts";
import { type Db } from "../_shared/supabaseAdmin.ts";
import { pictureLinks } from "../_shared/pictures.ts";
import { shownName, type Lang } from "../_shared/i18n.ts";
import { namedInviter } from "./invitations.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A person sends a link now and then; more than this in a day is not that. */
const MAX_FRIEND_LINKS_PER_DAY = 20;

export interface Friend {
  profileId: string;
  name: string;
  avatarUrl: string | null;
}

/** Your friends with their names and pictures, without anyone you have blocked. */
export async function listFriends(db: Db, profileId: string, lang: Lang): Promise<Friend[]> {
  const [{ data: rows, error }, { data: blocked, error: blockedErr }] = await Promise.all([
    db.from("friends").select("friend_id").eq("profile_id", profileId),
    db.from("blocked_people").select("blocked_id").eq("blocker_id", profileId),
  ]);
  if (error) throw error;
  if (blockedErr) throw blockedErr;
  const gone = new Set(blocked.map((b) => b.blocked_id as string));
  const ids = rows.map((r) => r.friend_id as string).filter((id) => !gone.has(id));
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesErr } = await db
    .from("profiles")
    .select("id, display_name, avatar_path")
    .in("id", ids);
  if (profilesErr) throw profilesErr;
  const pictures = await pictureLinks(
    db,
    profiles.map((p) => p.avatar_path as string | null),
  );
  return profiles
    .filter((p) => p.display_name)
    .map((p) => ({
      profileId: p.id as string,
      name: shownName(p.display_name as string, lang),
      avatarUrl: p.avatar_path ? (pictures.get(p.avatar_path as string) ?? null) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Both directions go: once either of you removes the other, neither is listed. */
export async function removeFriend(db: Db, profileId: string, friendId: string): Promise<void> {
  const { error } = await db
    .from("friends")
    .delete()
    .or(
      `and(profile_id.eq.${profileId},friend_id.eq.${friendId}),` +
        `and(profile_id.eq.${friendId},friend_id.eq.${profileId})`,
    );
  if (error) throw error;
}

/** The live link behind a token, and who made it; refused if it never was one or has expired. */
async function findFriendLink(db: Db, token: unknown): Promise<string> {
  if (!looksLikeInviteToken(token)) throw new HttpError(400, "That friend link is not valid.");
  const { data, error } = await db
    .from("friend_links")
    .select("created_by, expires_at")
    .eq("token_hash", await lookupHash(token, encryptionKeyFromEnv()))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "That friend link is not valid.");
  if (Date.parse(data.expires_at) <= Date.now()) {
    throw new HttpError(410, "That friend link has expired. Ask for a new one.");
  }
  return data.created_by as string;
}

/** A new link to send (#226). A fresh one each time, as only a fingerprint is kept. */
export async function makeFriendLink(db: Db, profileId: string, origin: string) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error: countErr } = await db
    .from("friend_links")
    .select("id", { count: "exact", head: true })
    .eq("created_by", profileId)
    .gt("created_at", since);
  if (countErr) throw countErr;
  if ((count ?? 0) >= MAX_FRIEND_LINKS_PER_DAY) {
    throw new HttpError(429, "You have made too many friend links today. Try again tomorrow.");
  }
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS).toISOString();
  const { error } = await db.from("friend_links").insert({
    token_hash: await lookupHash(token, encryptionKeyFromEnv()),
    created_by: profileId,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { url: `${origin}/friend/${token}`, expiresAt };
}

/** Who made a link, for the page it opens, before anyone signs in. */
export async function previewFriendLink(db: Db, token: unknown) {
  const madeBy = await findFriendLink(db, token);
  const { data, error } = await db
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", madeBy)
    .maybeSingle();
  if (error) throw error;
  const path = data?.avatar_path as string | null | undefined;
  return {
    friend: {
      name: namedInviter(data?.display_name),
      avatarUrl: (await pictureLinks(db, [path])).get(path ?? "") ?? null,
    },
  };
}

/**
 * The holder's tap is the yes: friends both ways, which only means they may
 * invite each other to groups. Blocked either way reads as a dead link, so the
 * answer never says who blocked whom.
 */
export async function addFriendByLink(db: Db, profileId: string, token: unknown) {
  const madeBy = await findFriendLink(db, token);
  if (madeBy === profileId) throw new HttpError(400, "This is your own friend link.");
  const { data: blocks, error: blockErr } = await db
    .from("blocked_people")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${profileId},blocked_id.eq.${madeBy}),and(blocker_id.eq.${madeBy},blocked_id.eq.${profileId})`,
    );
  if (blockErr) throw blockErr;
  if (blocks.length > 0) throw new HttpError(404, "That friend link is not valid.");
  const { error } = await db.from("friends").upsert(
    [
      { profile_id: profileId, friend_id: madeBy },
      { profile_id: madeBy, friend_id: profileId },
    ],
    { onConflict: "profile_id,friend_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}
