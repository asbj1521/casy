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
 */
import { type Caller, requireCaller } from "../_shared/auth.ts";
import { allowedFrontends, pickFrontend } from "../_shared/frontend.ts";
import {
  cleanDisplayName,
  cleanGroupName,
  displayNameFor,
  INVITE_LIFETIME_MS,
  inviteUrl,
  isMember,
  looksLikeInviteToken,
  newInviteToken,
  requireMember,
} from "../_shared/groups.ts";
import { afterResponse, HttpError, readRange, requireString, serve } from "../_shared/http.ts";
import { encryptionKeyFromEnv, lookupHash } from "../_shared/secretBox.ts";
import { type Db, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

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
async function groupBusy(db: Db, memberIds: string[], from: Date, to: Date) {
  const { data: sources, error: sourcesErr } = await db
    .from("calendar_sources")
    .select("id, purpose, priority, calendar_connections!inner(profile_id, status)")
    .in("calendar_connections.profile_id", memberIds)
    .eq("calendar_connections.status", "connected")
    // A calendar its owner unticked on My calendar doesn't count at all.
    .eq("included", true);
  if (sourcesErr) throw sourcesErr;

  type SourceRow = {
    id: string;
    purpose: string | null;
    priority: string;
    calendar_connections: { profile_id: string };
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
  return {
    busy: Object.fromEntries(busyByMember),
    connected: Object.fromEntries(memberIds.map((id) => [id, hasCalendar.has(id)])),
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
      return { name: await resolveOwnName(db, profileId, callerName) };

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
      return { ...(await list()), createdId: group.id };
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
      // Only a member may read a group's availability, and the membership
      // check is what decides it: holding the group's id proves nothing.
      // One query answers both "who is in it" and "is the caller in it".
      const { data: members, error } = await db
        .from("group_members")
        .select("profile_id")
        .eq("group_id", groupId);
      if (error) throw error;
      const memberIds = members.map((m) => m.profile_id);
      if (!memberIds.includes(profileId)) throw new HttpError(403, "You are not in that group.");
      return await groupBusy(db, memberIds, from, to);
    }

    default:
      throw new HttpError(400, `Unknown action "${action}"`);
  }
});
