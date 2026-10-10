/**
 * Friend groups: making one, inviting people, joining, leaving, deleting one
 * you made, and reading back the members with their busy times.
 *
 * One function rather than six, because every action is the same shape
 * underneath: work out who is calling, check they belong to the group, touch
 * two tables. Six near-identical files would be six things to deploy and keep
 * in step. The action is picked by the `action` field of the POST body.
 *
 * Identity always comes from the caller's verified login (_shared/auth.ts).
 * Nothing about who you are is ever read from the request, so being handed a
 * group id or an invite token gets you no further than being a member does.
 *
 * `preview` is the one action that works signed out: someone following an
 * invite link needs to see what they are joining before they sign in. It
 * reveals only the group's name and how many people are in it, to whoever
 * already holds the link they were sent.
 *
 * What members learn about each other is deliberately narrow: a display name
 * and busy time ranges. Never an email address, never a calendar's name,
 * never an event title (none are stored anywhere, see the calendar tables).
 *
 * Invitations (invite-members, invitations, accept-invitation,
 * decline-invitation) bring people in from inside Casy: someone you share a
 * group with, or the exact email of an account. Joining always takes the
 * invited person's own yes, and an email never reveals whether it matched.
 *
 * `refresh` syncs the members' calendars that are more than a few minutes
 * old, while someone plans for the group, so the search doesn't offer a time
 * filled since the hourly sync (_shared/groupRefresh.ts).
 */
import { aiAllowed, eventLabelsAllowed } from "../_shared/aiAccess.ts";
import { type Caller, requireCaller } from "../_shared/auth.ts";
import { allowedFrontends, pickFrontend } from "../_shared/frontend.ts";
import { claimStaleConnections, freshForMs, refreshTargets } from "../_shared/groupRefresh.ts";
import {
  cleanDisplayName,
  cleanGroupName,
  displayNameFor,
  INVITE_LIFETIME_MS,
  type Invitees,
  inviteUrl,
  isMember,
  looksLikeInviteToken,
  MAX_EMAIL_LOOKUPS_PER_DAY,
  MAX_PICKED_PER_DAY,
  newInviteToken,
  readInvitees,
  requireMember,
} from "../_shared/groups.ts";
import { afterResponse, HttpError, readRange, requireString, serve } from "../_shared/http.ts";
import { encryptionKeyFromEnv, lookupHash } from "../_shared/secretBox.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncConnection } from "../_shared/sync.ts";

const PAGE_SIZE = 1000; // PostgREST's default row cap per request
const MAX_PAGES = 20; // a whole group's year, bounded

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
async function rememberName(db: Db, caller: Caller): Promise<void> {
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
async function membersAsMember(db: Db, groupId: string, profileId: string): Promise<string[]> {
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
async function listGroups(db: Db, profileId: string, callerName: string) {
  type Row = {
    friend_groups: {
      id: string;
      name: string;
      created_at: string;
      created_by: string | null;
      group_members: { profile_id: string; joined_at: string }[];
    } | null;
  };
  const { data: mine, error: mineErr } = await db
    .from("group_members")
    .select("friend_groups(id, name, created_at, created_by, group_members(profile_id, joined_at))")
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
  const { data: names, error: namesErr } = await db
    .from("profiles")
    .select("id, display_name, name_is_custom")
    .in("id", memberIds);
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
  const { data: invitations, error: invitationsErr } = await db
    .from("group_invitations")
    .select("group_id, profile_id")
    .in(
      "group_id",
      groups.map((g) => g.id),
    );
  if (invitationsErr) throw invitationsErr;
  const invitedTo = new Map<string, string[]>();
  for (const i of invitations) {
    if (!known.has(i.profile_id)) continue;
    invitedTo.set(i.group_id, [...(invitedTo.get(i.group_id) ?? []), i.profile_id]);
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Everyone the caller shares a group with right now, themself left out. */
async function knownPeople(db: Db, profileId: string): Promise<Set<string>> {
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
interface ResolvedInvitees {
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
async function resolveInvitees(
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
async function sendInvites(
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
async function listInvitations(db: Db, profileId: string) {
  const { data: rows, error } = await db
    .from("group_invitations")
    .select("group_id, invited_by, created_at, friend_groups!inner(name)")
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
    memberCount: memberCount.get(r.group_id) ?? 0,
    // Null once the inviter's account is gone; the invitation still stands.
    invitedBy: r.invited_by ? (nameOf.get(r.invited_by) ?? null) : null,
    createdAt: r.created_at,
  }));
}

/** What this person is called: their chosen name if they set one, else their login-derived name. */
async function resolveOwnName(db: Db, profileId: string, callerName: string): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("display_name, name_is_custom")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data?.name_is_custom && data.display_name ? data.display_name : callerName;
}

/** The live invite behind a link, with its group; refused if it never was one or has expired. */
async function findInvite(db: Db, token: unknown) {
  if (!looksLikeInviteToken(token)) throw new HttpError(400, "That invite link is not valid.");
  const { data: invite, error } = await db
    .from("group_invites")
    .select("group_id, expires_at, friend_groups!inner(name)")
    .eq("token_hash", await lookupHash(token, encryptionKeyFromEnv()))
    .maybeSingle();
  if (error) throw error;
  if (!invite) throw new HttpError(404, "That invite link is not valid.");
  if (Date.parse(invite.expires_at) <= Date.now()) {
    throw new HttpError(410, "That invite link has expired. Ask for a new one.");
  }
  // A to-one embed, which the untyped client takes for a list.
  const group = invite.friend_groups as unknown as { name: string };
  return { groupId: invite.group_id as string, groupName: group.name };
}

/**
 * Everyone's busy blocks in a group, for a window, grouped by person.
 *
 * Only the time ranges cross over: which calendar a block came from, and what
 * that calendar is called, stay with their owner. So a member sees when you
 * are busy, never that it was "Work" or "Dentist".
 */
/**
 * A member's calendar is called outdated once it hasn't been updated for this
 * long: a phone whose app hasn't been opened (the only way its calendars
 * reach Casy), or an account whose sync keeps failing. Their busy times still
 * count; the page only says so.
 */
const OUTDATED_AFTER_MS = 2 * 24 * 60 * 60_000;

async function groupBusy(db: Db, memberIds: string[], from: Date, to: Date) {
  const { data: sources, error: sourcesErr } = await db
    .from("calendar_sources")
    .select("id, purpose, priority, calendar_connections!inner(profile_id, status, last_synced_at)")
    .in("calendar_connections.profile_id", memberIds)
    .eq("calendar_connections.status", "connected")
    // A calendar its owner unticked on My calendar doesn't count at all.
    .eq("included", true);
  if (sourcesErr) throw sourcesErr;

  type SourceRow = {
    id: string;
    purpose: string | null;
    priority: string;
    calendar_connections: { profile_id: string; last_synced_at: string | null };
  };
  // What each block carries besides its times, from its calendar. Work and
  // school are the "soft" kinds the multi-day rules treat as time you could
  // take off, and a priority says whether its owner would skip it ("skip")
  // or never would ("never"); both are left out when they don't apply. Like
  // this, a block says how much it matters, never what it is.
  const sourceById = new Map(
    // `!inner` on a to-one join makes the connection a single row, which
    // only a cast can say.
    (sources as unknown as SourceRow[]).map((s) => [
      s.id,
      {
        owner: s.calendar_connections.profile_id,
        tags: {
          ...(s.purpose === "work" || s.purpose === "school" ? { category: s.purpose } : {}),
          ...(s.priority === "skip" || s.priority === "never" ? { priority: s.priority } : {}),
        },
      },
    ]),
  );

  const busyByMember = new Map<string, { start: string; end: string }[]>(
    memberIds.map((id) => [id, []]),
  );
  const sourceIds = [...sourceById.keys()];
  let truncated = false;
  if (sourceIds.length > 0) {
    // Overlap test: a block is in range if it starts before the range ends
    // and ends after the range starts.
    const fetchPage = (page: number, withCount = false) =>
      db
        .from("calendar_busy_cache")
        .select("source_id, start_at, end_at", withCount ? { count: "exact" } : undefined)
        .in("source_id", sourceIds)
        .lt("start_at", to.toISOString())
        .gt("end_at", from.toISOString())
        .order("start_at", { ascending: true })
        .order("id", { ascending: true }) // stable paging when start times tie
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    // The first page also says how many blocks there are in total, so every
    // other page can be asked for at once instead of one after another.
    const first = await fetchPage(0, true);
    if (first.error) throw first.error;
    const pagesNeeded = Math.ceil((first.count ?? first.data.length) / PAGE_SIZE);
    truncated = pagesNeeded > MAX_PAGES;
    const extraPages = Math.max(0, Math.min(pagesNeeded, MAX_PAGES) - 1);
    const rest = await Promise.all(Array.from({ length: extraPages }, (_, i) => fetchPage(i + 1)));
    for (const page of [first, ...rest]) {
      if (page.error) throw page.error;
      for (const r of page.data) {
        const source = sourceById.get(r.source_id);
        if (!source) continue;
        busyByMember.get(source.owner)?.push({ start: r.start_at, end: r.end_at, ...source.tags });
      }
    }
  }

  // Who has actually linked something: a member with no calendar reads as
  // free all year, which the page must be able to say out loud rather than
  // quietly counting them as available.
  const hasCalendar = new Set([...sourceById.values()].map((s) => s.owner));

  // Whose calendars are outdated, and since when: each member's least
  // recently updated account among the calendars that count. Only for those
  // past OUTDATED_AFTER_MS, so how often others open their app isn't shown.
  const oldest = new Map<string, number>();
  for (const s of sources as unknown as SourceRow[]) {
    const at = Date.parse(s.calendar_connections.last_synced_at ?? "") || 0;
    const owner = s.calendar_connections.profile_id;
    oldest.set(owner, Math.min(oldest.get(owner) ?? Infinity, at));
  }
  const outdatedBefore = Date.now() - OUTDATED_AFTER_MS;
  const outdated = Object.fromEntries(
    [...oldest]
      .filter(([, at]) => at > 0 && at < outdatedBefore)
      .map(([id, at]) => [id, new Date(at).toISOString()]),
  );
  return {
    busy: Object.fromEntries(busyByMember),
    connected: Object.fromEntries(memberIds.map((id) => [id, hasCalendar.has(id)])),
    outdated,
    truncated,
  };
}

serve("groups", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();

  // Previewing an invite is the one thing that happens before signing in:
  // the link itself is the only thing proving you were meant to see it.
  if (action === "preview") {
    const { groupId, groupName } = await findInvite(db, body.token);
    const { count, error } = await db
      .from("group_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if (error) throw error;
    return { group: { id: groupId, name: groupName, memberCount: count ?? 0 } };
  }

  const caller = await requireCaller(req, db);

  // Asked every few seconds by every open page, so it does nothing else: no
  // name saved, one read-only query (live_pulse in the live_pulse migration).
  if (action === "pulse") {
    const { data, error } = await db.rpc("live_pulse", { p_profile_id: caller.id });
    if (error) throw error;
    return { pulse: data as string };
  }

  const profileId = caller.id;
  const callerName = displayNameFor(caller);
  // Saved in the background: nothing below waits on it, since the caller's
  // own name is taken straight from their login wherever it is shown. The
  // worst a failure does is leave a slightly stale name.
  afterResponse("remember_login_name", () => rememberName(db, caller));
  const list = async () => ({ groups: await listGroups(db, profileId, callerName) });

  switch (action) {
    case "list":
      return await list();

    case "whoami":
      return {
        name: await resolveOwnName(db, profileId, callerName),
        // Whether the AI features are on for you while they are tested (#111).
        // A failure (the migration not yet applied) is "not yet", never a broken page.
        aiAllowed: await aiAllowed(db, profileId).catch((err) => {
          console.error("whoami: couldn't check AI access", err);
          return false;
        }),
        // Whether this person's phone labels their events (#112).
        eventLabels: await eventLabelsAllowed(db, profileId).catch((err) => {
          console.error("whoami: couldn't check event labels", err);
          return false;
        }),
      };

    case "set-name": {
      const name = cleanDisplayName(body.name);
      if (!name) throw new HttpError(400, "Give yourself a name.");
      const { error } = await db.from("profiles").upsert(
        {
          id: profileId,
          display_name: name,
          name_is_custom: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      return { name };
    }

    case "create": {
      const name = cleanGroupName(body.name);
      if (!name) throw new HttpError(400, "Give the group a name.");
      // Limits and lookups first: a refused invitation makes no group.
      const invitees = await resolveInvitees(db, profileId, readInvitees(body));
      const { data: group, error: groupErr } = await db
        .from("friend_groups")
        .insert({ name, created_by: profileId })
        .select("id")
        .single();
      if (groupErr) throw groupErr;

      // The creator is simply its first member; nothing else marks them out.
      const { error: memberErr } = await db
        .from("group_members")
        .insert({ group_id: group.id, profile_id: profileId });
      if (memberErr) {
        // The limit trigger refused, so undo the group rather than leave one
        // nobody is in.
        await db.from("friend_groups").delete().eq("id", group.id);
        throw new HttpError(400, memberErr.message);
      }
      await sendInvites(db, group.id, profileId, invitees);
      return { ...(await list()), createdId: group.id };
    }

    case "invite-members": {
      const groupId = requireString(body, "groupId");
      // Any member may invite, as with links.
      await requireMember(db, groupId, profileId);
      await sendInvites(
        db,
        groupId,
        profileId,
        await resolveInvitees(db, profileId, readInvitees(body)),
      );
      return await list();
    }

    case "invitations":
      return { invitations: await listInvitations(db, profileId) };

    case "accept-invitation": {
      const groupId = requireString(body, "groupId");
      const { data: outcome, error } = await db.rpc("accept_group_invitation", {
        p_group_id: groupId,
        p_profile_id: profileId,
      });
      // The member limits trigger refused (group full, or 20 groups already).
      if (error) throw new HttpError(400, error.message);
      if (outcome === "not_invited") {
        throw new HttpError(404, "That invitation is no longer open.");
      }
      return {
        ...(await list()),
        invitations: await listInvitations(db, profileId),
        joinedId: groupId,
      };
    }

    case "decline-invitation": {
      const groupId = requireString(body, "groupId");
      // Kept as declined, which stops new invitations to this group until
      // the nightly cleanup deletes it, 6 months after it was sent
      // (cleanup_old_data); the inviter is not told (their list shows the
      // person as invited still).
      const { error } = await db
        .from("group_invitations")
        .update({ status: "declined" })
        .eq("group_id", groupId)
        .eq("profile_id", profileId)
        .eq("status", "pending");
      if (error) throw error;
      return { invitations: await listInvitations(db, profileId) };
    }

    case "rename": {
      const groupId = requireString(body, "groupId");
      const name = cleanGroupName(body.name);
      if (!name) throw new HttpError(400, "Give the group a name.");
      // Any member may rename, the same as inviting: it is a shared label
      // for the group, not something only its creator should control.
      await requireMember(db, groupId, profileId);
      const { error } = await db.from("friend_groups").update({ name }).eq("id", groupId);
      if (error) throw error;
      return await list();
    }

    case "invite": {
      const groupId = requireString(body, "groupId");
      // Any member may invite, which was a deliberate choice: asking the
      // group's creator to hand out every link is a bottleneck, not a
      // safeguard.
      await requireMember(db, groupId, profileId);

      // A new link every time this is pressed, and every unexpired link for
      // the group keeps working. That falls out of storing only a
      // fingerprint: nothing can turn a stored hash back into a link, so an
      // earlier one can't be handed out again, and replacing it would
      // quietly break the link already sent to someone else.
      //
      // Old links are left to expire on their own. Each is reusable by any
      // number of people for its seven days, so this is a handful of rows
      // per group, not a stream of them.
      const token = newInviteToken();
      const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS).toISOString();
      const { error } = await db.from("group_invites").insert({
        group_id: groupId,
        token_hash: await lookupHash(token, encryptionKeyFromEnv()),
        created_by: profileId,
        expires_at: expiresAt,
      });
      if (error) throw error;
      const origin = pickFrontend(req.headers.get("Origin"), allowedFrontends());
      return { url: inviteUrl(origin, token), expiresAt };
    }

    case "join": {
      const { groupId } = await findInvite(db, body.token);
      // Already in it: nothing to do, rather than failing on the primary key
      // (or on the member limit, if the group is full with them in it).
      if (!(await isMember(db, groupId, profileId))) {
        const { error } = await db
          .from("group_members")
          .insert({ group_id: groupId, profile_id: profileId });
        if (error) throw new HttpError(400, error.message);
      }
      // In now, so any invitation to this group (open or declined) is done with.
      const { error: clearErr } = await db
        .from("group_invitations")
        .delete()
        .eq("group_id", groupId)
        .eq("profile_id", profileId);
      if (clearErr) throw clearErr;
      return { ...(await list()), joinedId: groupId };
    }

    case "leave": {
      const groupId = requireString(body, "groupId");
      // The database decides whether that was the last member, and deletes
      // the group with them if so (leave_friend_group, one transaction).
      const { data: outcome, error } = await db.rpc("leave_friend_group", {
        p_group_id: groupId,
        p_profile_id: profileId,
      });
      if (error) throw error;
      if (outcome === "not_a_member") throw new HttpError(403, "You are not in that group.");
      return { ...(await list()), outcome };
    }

    case "delete": {
      const groupId = requireString(body, "groupId");
      // Only the person who made the group may delete it outright: the one
      // power `created_by` actually grants. Everyone else's way out is
      // "leave", which only removes themself.
      const { data: group, error: groupErr } = await db
        .from("friend_groups")
        .select("created_by")
        .eq("id", groupId)
        .maybeSingle();
      if (groupErr) throw groupErr;
      if (!group) throw new HttpError(404, "That group no longer exists.");
      if (group.created_by !== profileId) {
        throw new HttpError(403, "Only the person who made this group can delete it.");
      }
      // group_members and group_invites cascade off this delete (see the
      // friend_groups migration's foreign keys), so nothing else to clean up.
      const { error } = await db.from("friend_groups").delete().eq("id", groupId);
      if (error) throw error;
      return { ...(await list()), outcome: "deleted" };
    }

    case "busy": {
      const groupId = requireString(body, "groupId");
      const { from, to } = readRange(body.from, body.to);
      const memberIds = await membersAsMember(db, groupId, profileId);
      return await groupBusy(db, memberIds, from, to);
    }

    // Someone is planning for this group: sync the members' calendars that
    // haven't been for `freshForSeconds` (one to ten minutes), so the search
    // uses busy times minutes old rather than up to an hour
    // (_shared/groupRefresh.ts). Answers by a
    // deadline; slower syncs finish after it. Says nothing about whose.
    case "refresh": {
      const groupId = requireString(body, "groupId");
      const memberIds = await membersAsMember(db, groupId, profileId);
      const key = encryptionKeyFromEnv();
      const due = await claimStaleConnections(db, memberIds, freshForMs(body.freshForSeconds));
      const { complete, synced, rest } = await refreshTargets(due, (target) =>
        syncConnection(db, target, key),
      );
      if (!complete) afterResponse("group refresh", () => rest);
      return { complete, synced };
    }

    default:
      throw new HttpError(400, `Unknown action "${action}"`);
  }
});
