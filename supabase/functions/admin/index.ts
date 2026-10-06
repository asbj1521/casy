/**
 * Admin mode: a whole-app view for the project owner, and the few actions
 * that go with it (delete any group, remove someone from a group, delete an
 * account, re-sync a calendar account).
 *
 * Who is an admin is decided here and only here: the caller's verified login
 * (_shared/auth.ts) must be listed in the ADMIN_USER_IDS secret
 * (_shared/admin.ts). The profile page hides the admin button from everyone
 * else, but that is a convenience; this check is the actual lock. Every
 * action but `status` re-checks it, so a hand-made request gets a 403.
 *
 * `status` answers any signed-in person with a yes or no, which is how the
 * page knows whether to show the button at all.
 *
 * Even an admin sees only what support needs: names, dates, counts and sync
 * health. Never an email address, never a calendar's name or account label
 * (a Google account's label is its email), never a busy time or anything
 * about an event.
 */
import { isAdminId } from "../_shared/admin.ts";
import { deleteAccount } from "../_shared/accounts.ts";
import { requireCaller } from "../_shared/auth.ts";
import { displayNameFor } from "../_shared/groups.ts";
import { healthOf, readSyncFacts } from "../_shared/health.ts";
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { encryptionKeyFromEnv } from "../_shared/secretBox.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
// Only the type here. The sync code itself (with ical.js and an XML parser
// behind it) is imported inside the sync actions, so the everyday calls,
// "status" above all, don't pay for loading it on a cold start.
import type { SyncTarget } from "../_shared/sync.ts";

/** Auth's admin API pages users; this many per page, this many pages at most. */
const USERS_PER_PAGE = 1000;
const MAX_USER_PAGES = 10;

interface AuthUserRow {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  created_at: string;
  last_sign_in_at?: string | null;
}

/** Every account, from Supabase Auth. Emails are read only to derive a name. */
async function allUsers(db: Db): Promise<{ users: AuthUserRow[]; truncated: boolean }> {
  const users: AuthUserRow[] = [];
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw error;
    users.push(...(data.users as AuthUserRow[]));
    if (data.users.length < USERS_PER_PAGE) return { users, truncated: false };
  }
  return { users, truncated: true };
}

/** Everything admin mode shows, in one round trip. */
async function overview(db: Db) {
  const [
    { users, truncated },
    { data: profiles, error: profilesErr },
    { data: groups, error: groupsErr },
    { data: members, error: membersErr },
    { data: connections, error: connectionsErr },
    { count: busyBlocks, error: busyErr },
  ] = await Promise.all([
    allUsers(db),
    db.from("profiles").select("id, display_name"),
    db
      .from("friend_groups")
      .select("id, name, created_at, created_by")
      .order("created_at", { ascending: false }),
    db
      .from("group_members")
      .select("group_id, profile_id, joined_at")
      .order("joined_at", { ascending: true }),
    db
      .from("calendar_connections")
      .select(
        "id, profile_id, provider, status, created_at, last_synced_at, last_sync_attempt_at, sync_error, needs_reconnect, calendar_sources(count)",
      )
      .order("created_at", { ascending: false }),
    db.from("calendar_busy_cache").select("id", { count: "exact", head: true }),
  ]);
  if (profilesErr) throw profilesErr;
  if (groupsErr) throw groupsErr;
  if (membersErr) throw membersErr;
  if (connectionsErr) throw connectionsErr;
  if (busyErr) throw busyErr;

  // The name people chose shows in groups (profiles); anyone who never used
  // groups falls back to the same rule that fills profiles in the first place.
  const storedName = new Map(
    (profiles ?? []).map((p: { id: string; display_name: string | null }) => [
      p.id,
      p.display_name,
    ]),
  );
  const nameOf = new Map(users.map((u) => [u.id, storedName.get(u.id) ?? displayNameFor(u)]));
  const name = (id: string | null) =>
    id ? (nameOf.get(id) ?? "Deleted account") : "Deleted account";

  type MemberRow = { group_id: string; profile_id: string; joined_at: string };
  type ConnectionRow = {
    id: string;
    profile_id: string;
    provider: string;
    status: string;
    created_at: string;
    last_synced_at: string | null;
    last_sync_attempt_at: string | null;
    sync_error: string | null;
    needs_reconnect: boolean;
    calendar_sources: { count: number }[];
  };
  const memberRows = (members ?? []) as MemberRow[];
  const connectionRows = (connections ?? []) as unknown as ConnectionRow[];

  const groupsJoined = new Map<string, number>();
  for (const m of memberRows)
    groupsJoined.set(m.profile_id, (groupsJoined.get(m.profile_id) ?? 0) + 1);
  const calendarsLinked = new Map<string, number>();
  for (const c of connectionRows) {
    if (c.status === "connected")
      calendarsLinked.set(c.profile_id, (calendarsLinked.get(c.profile_id) ?? 0) + 1);
  }

  const health = healthOf(await readSyncFacts(db));
  const failing = connectionRows.filter(
    (c) => c.status === "connected" && (c.needs_reconnect || c.sync_error),
  ).length;

  return {
    // The same answer the uptime monitor gets from the health function.
    health,
    stats: {
      users: users.length,
      groups: (groups ?? []).length,
      connectedAccounts: connectionRows.filter((c) => c.status === "connected").length,
      failingSyncs: failing,
      busyBlocks: busyBlocks ?? 0,
    },
    groups: (groups ?? []).map(
      (g: { id: string; name: string; created_at: string; created_by: string | null }) => ({
        id: g.id,
        name: g.name,
        createdAt: g.created_at,
        createdBy: g.created_by,
        createdByName: g.created_by ? name(g.created_by) : null,
        members: memberRows
          .filter((m) => m.group_id === g.id)
          .map((m) => ({
            profileId: m.profile_id,
            name: name(m.profile_id),
            joinedAt: m.joined_at,
          })),
      }),
    ),
    users: users
      .map((u) => ({
        id: u.id,
        name: name(u.id),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        groups: groupsJoined.get(u.id) ?? 0,
        calendars: calendarsLinked.get(u.id) ?? 0,
      }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    usersTruncated: truncated,
    connections: connectionRows.map((c) => ({
      id: c.id,
      ownerId: c.profile_id,
      ownerName: name(c.profile_id),
      provider: c.provider,
      status: c.status,
      calendars: c.calendar_sources?.[0]?.count ?? 0,
      createdAt: c.created_at,
      lastSyncedAt: c.last_synced_at,
      lastSyncAttemptAt: c.last_sync_attempt_at,
      syncError: c.sync_error,
      needsReconnect: c.needs_reconnect,
    })),
  };
}

serve("admin", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();
  const caller = await requireCaller(req, db);
  const isAdmin = isAdminId(caller.id, Deno.env.get("ADMIN_USER_IDS"));

  if (action === "status") return { isAdmin };
  if (!isAdmin) throw new HttpError(403, "Admins only.");

  switch (action) {
    case "overview":
      return await overview(db);

    case "deleteGroup": {
      const groupId = requireString(body, "groupId");
      // Members and invites cascade off the group (friend_groups migration).
      const { data, error } = await db
        .from("friend_groups")
        .delete()
        .eq("id", groupId)
        .select("name");
      if (error) throw error;
      if (data.length === 0) throw new HttpError(404, "That group no longer exists.");
      console.log(`admin ${caller.id} deleted group ${groupId} ("${data[0].name}")`);
      return { outcome: "deleted" };
    }

    case "removeMember": {
      const groupId = requireString(body, "groupId");
      const profileId = requireString(body, "profileId");
      // The same transaction as leaving, so removing the last member deletes
      // the group rather than leaving an empty one nobody can reach.
      const { data: outcome, error } = await db.rpc("leave_friend_group", {
        p_group_id: groupId,
        p_profile_id: profileId,
      });
      if (error) throw error;
      if (outcome === "not_a_member") throw new HttpError(404, "They are not in that group.");
      console.log(`admin ${caller.id} removed ${profileId} from group ${groupId}: ${outcome}`);
      return { outcome };
    }

    case "deleteUser": {
      const profileId = requireString(body, "profileId");
      // Deleting yourself from here would be an accident, never the intent.
      if (profileId === caller.id) {
        throw new HttpError(400, "You can't delete your own account from admin mode.");
      }
      const { data: found, error } = await db.auth.admin.getUserById(profileId);
      if (error || !found.user) throw new HttpError(404, "That account no longer exists.");

      // The same as someone deleting their own account (_shared/accounts.ts).
      const { leftGroups, deletedGroups } = await deleteAccount(db, profileId);
      console.log(
        `admin ${caller.id} deleted user ${profileId}; left ${leftGroups} groups, ${deletedGroups} deleted as empty`,
      );
      return { outcome: "deleted", leftGroups, deletedGroups };
    }

    case "syncConnection": {
      const connectionId = requireString(body, "connectionId");
      const { data: target, error } = await db
        .from("calendar_connections")
        .select("id, provider, status")
        .eq("id", connectionId)
        .maybeSingle();
      if (error) throw error;
      if (!target) throw new HttpError(404, "That account no longer exists.");
      if (target.status !== "connected") throw new HttpError(400, "That account isn't connected.");
      const key = encryptionKeyFromEnv();
      console.log(`admin ${caller.id} re-synced connection ${connectionId}`);
      const { syncConnection } = await import("../_shared/sync.ts");
      // Never throws; the outcome is recorded on the connection either way.
      return await syncConnection(db, target as SyncTarget, key);
    }

    case "syncUser": {
      // Every connected account of one person, like their own "Sync now"
      // but without its cooldown: an admin asking means now.
      const profileId = requireString(body, "userId");
      const { data: targets, error } = await db
        .from("calendar_connections")
        .select("id, provider")
        .eq("profile_id", profileId)
        .eq("status", "connected");
      if (error) throw error;
      const key = encryptionKeyFromEnv();
      const { syncConnection } = await import("../_shared/sync.ts");
      let synced = 0;
      let failed = 0;
      let busyBlocks = 0;
      // One at a time, as the person's own sync does: a handful of
      // accounts, and parallel calls only risk a provider's rate limit.
      for (const target of targets as SyncTarget[]) {
        const outcome = await syncConnection(db, target, key);
        if (outcome.ok) {
          synced++;
          busyBlocks += outcome.busyBlocks;
        } else failed++;
      }
      console.log(`admin ${caller.id} re-synced user ${profileId}: ${synced} ok, ${failed} failed`);
      return { synced, failed, busyBlocks };
    }

    default:
      throw new HttpError(400, `Unknown action "${action}"`);
  }
});
