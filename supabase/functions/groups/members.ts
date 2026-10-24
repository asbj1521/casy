/** The groups function's members, names and group list (#160, split out of index.ts). */
import {
  aiAllowed,
  aiConsented,
  aiSharesCorrections,
  aiTesterAllowed,
} from "../_shared/aiAccess.ts";
import { type Caller } from "../_shared/auth.ts";
import { displayNameFor } from "../_shared/groups.ts";
import { HttpError } from "../_shared/http.ts";
import { type Db } from "../_shared/supabaseAdmin.ts";

/**
 * Remember what the caller is called, from their own verified login.
 *
 * This is how a member list can say "Simon": names live in auth.users, which
 * group queries can't join to, so each person's name is copied into `profiles`
 * whenever they use the app.
 *
 * Goes through the remember_login_name function rather than a plain upsert
 * because it has to back off once someone has chosen their own name: a plain
 * upsert would stomp a custom name right back to the login-derived one on the
 * very next call.
 */
export async function rememberName(db: Db, caller: Caller): Promise<void> {
  const { error } = await db.rpc("remember_login_name", {
    p_id: caller.id,
    p_display_name: displayNameFor(caller),
  });
  if (error) throw error;
}

/**
 * Everyone in a group, for a caller who must be in it. Only a member may read
 * or refresh a group's availability, and the membership check is what decides
 * it: holding the group's id proves nothing. One query answers both "who is in
 * it" and "is the caller in it".
 */
export async function membersAsMember(
  db: Db,
  groupId: string,
  profileId: string,
): Promise<string[]> {
  const { data: members, error } = await db
    .from("group_members")
    .select("profile_id")
    .eq("group_id", groupId);
  if (error) throw error;
  const memberIds = members.map((m) => m.profile_id as string);
  if (!memberIds.includes(profileId)) throw new HttpError(403, "You are not in that group.");
  return memberIds;
}

/**
 * The groups this person is in, each with its members' names.
 *
 * Two round trips whatever the number of groups: one for the groups with all
 * their members (embedded through the foreign keys), one for the names.
 * `callerName` is the caller's own name straight from their login, so they
 * are named correctly even before rememberName's write has landed.
 */
export async function listGroups(db: Db, profileId: string, callerName: string) {
  type Row = {
    friend_groups: {
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      created_by: string | null;
      group_members: { profile_id: string; joined_at: string }[];
    } | null;
  };
  const { data: mine, error: mineErr } = await db
    .from("group_members")
    .select(
      "friend_groups(id, name, description, created_at, created_by, group_members(profile_id, joined_at))",
    )
    .eq("profile_id", profileId);
  if (mineErr) throw mineErr;

  // A to-one embed comes back as a single row, which the untyped client
  // can't know; hence the cast.
  const groups = (mine as unknown as Row[])
    .map((r) => r.friend_groups)
    .filter((g) => g !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (groups.length === 0) return [];

  // The caller's own id is included here too, not just other members': if
  // they have chosen a custom name, that is what they should see themself
  // called, the same as everyone else does.
  const memberIds = [...new Set(groups.flatMap((g) => g.group_members.map((m) => m.profile_id)))];
  // The names and the invitations only need the groups, so both are asked
  // for side by side (#158).
  const [{ data: names, error: namesErr }, { data: invitations, error: invitationsErr }] =
    await Promise.all([
      db.from("profiles").select("id, display_name, name_is_custom").in("id", memberIds),
      db
        .from("group_invitations")
        .select("group_id, profile_id")
        .in(
          "group_id",
          groups.map((g) => g.id),
        ),
    ]);
  if (namesErr) throw namesErr;
  const profileOf = new Map(names.map((p) => [p.id, p]));

  // The caller's own login-derived name (callerName) is fresher than
  // whatever rememberName last saved, so it wins unless a custom name is on
  // file: that one only a deliberate "set-name" call can produce.
  const own = profileOf.get(profileId);
  const ownName = own?.name_is_custom && own.display_name ? own.display_name : callerName;

  // Who has been invited to each group, but only people the caller already
  // shares a group with: anyone else's name (or the fact that an email found
  // an account) is not theirs to learn. Declined invitations read as invited,
  // so a "no thanks" is never reported back.
  const known = new Set(memberIds);
  if (invitationsErr) throw invitationsErr;
  const invitedTo = new Map<string, string[]>();
  for (const i of invitations) {
    if (!known.has(i.profile_id)) continue;
    invitedTo.set(i.group_id, [...(invitedTo.get(i.group_id) ?? []), i.profile_id]);
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    // What the group is for (#152), in its members' words; null for none.
    description: g.description,
    createdAt: g.created_at,
    // Whoever made the group, so the frontend can offer them (and only
    // them) the delete action. Grants nothing by itself; every membership
    // check still runs.
    createdBy: g.created_by,
    members: [...g.group_members]
      .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at))
      .map((m) => ({
        profileId: m.profile_id,
        name:
          m.profile_id === profileId
            ? ownName
            : (profileOf.get(m.profile_id)?.display_name ?? "Someone"),
        isYou: m.profile_id === profileId,
        joinedAt: m.joined_at,
      })),
    invited: invitedTo.get(g.id) ?? [],
  }));
}

/** What this person is called: their chosen name if they set one, else their login-derived name. */
export async function resolveOwnName(
  db: Db,
  profileId: string,
  callerName: string,
): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("display_name, name_is_custom")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data?.name_is_custom && data.display_name ? data.display_name : callerName;
}

/**
 * Who the caller is, for the page (the `whoami` action): their name and what
 * of the AI is on for them. The checks don't depend on each other, so they
 * run side by side (#158). Any of them failing (a migration not yet applied)
 * is "not yet", never a broken page.
 */
export async function whoAmI(db: Db, profileId: string, callerName: string) {
  const orNo = (what: string) => (err: unknown) => {
    console.error(`whoami: couldn't check ${what}`, err);
    return false;
  };
  const [name, allowed, consent, share, tester] = await Promise.all([
    resolveOwnName(db, profileId, callerName),
    // Whether the AI features are on for you while they are tested (#111).
    aiAllowed(db, profileId).catch(orNo("AI access")),
    // Whether they said yes to the AI using content from their calendar (#120).
    aiConsented(db, profileId).catch(orNo("AI consent")),
    // Whether their corrections of the AI go to Casy for review (#122).
    aiSharesCorrections(db, profileId).catch(orNo("sharing")),
    // Whether this person gets the admin-only AI features being tested:
    // admins and AI testers. Also as eventLabels, the name app builds from
    // before testers read it by.
    aiTesterAllowed(db, profileId).catch(orNo("AI testers")),
  ]);
  return {
    name,
    aiAllowed: allowed,
    aiConsent: consent,
    aiShare: share,
    aiTester: tester,
    eventLabels: tester,
  };
}
