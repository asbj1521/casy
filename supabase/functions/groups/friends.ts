/**
 * Friends (#222): people you have shared a group with, who stay invitable
 * after that group is gone. A trigger on group_members fills the table. It
 * stays an invitation: joining takes their own yes, and blocking always wins.
 */
import { type Db } from "../_shared/supabaseAdmin.ts";
import { pictureLinks } from "../_shared/pictures.ts";
import { shownName, type Lang } from "../_shared/i18n.ts";

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
