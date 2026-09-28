/**
 * Deleting a whole account: the person deleting their own (the account
 * function) and an admin deleting someone's (the admin function) do exactly
 * the same thing.
 *
 * They leave each of their groups first, the same way the Leave button does
 * (leave_friend_group): a group they were alone in is deleted, and an event
 * that was only waiting on their answer gets scheduled, which a plain cascade
 * would leave waiting forever. Then the account itself goes, and the foreign
 * keys take everything it owns with it: calendar accounts, stored
 * credentials, busy times, their name and primary calendar. Events they
 * suggested stay for the others, with nobody named as the suggester.
 *
 * Should deleting the account fail after the groups were left, it can simply
 * be tried again: leaving is already done, and nothing else changed.
 */
import type { supabaseAdmin } from "./supabaseAdmin.ts";

type Db = ReturnType<typeof supabaseAdmin>;

export async function deleteAccount(
  db: Db,
  profileId: string,
): Promise<{ leftGroups: number; deletedGroups: number }> {
  const { data: memberships, error: memberErr } = await db
    .from("group_members")
    .select("group_id")
    .eq("profile_id", profileId);
  if (memberErr) throw memberErr;

  let deletedGroups = 0;
  for (const { group_id } of (memberships ?? []) as { group_id: string }[]) {
    const { data: outcome, error } = await db.rpc("leave_friend_group", {
      p_group_id: group_id,
      p_profile_id: profileId,
    });
    if (error) throw error;
    if (outcome === "group_deleted") deletedGroups++;
  }

  const { error: deleteErr } = await db.auth.admin.deleteUser(profileId);
  if (deleteErr) throw deleteErr;
  return { leftGroups: (memberships ?? []).length, deletedGroups };
}
