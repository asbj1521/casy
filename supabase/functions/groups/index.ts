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
 * Report and block (#142, _shared/safety.ts): `report` files a report of a
 * group, an event in it or a member, `block`/`unblock` stop or allow one
 * person's invitations, `blocked` lists who you blocked.
 *
 * `refresh` syncs the members' calendars that are more than a few minutes
 * old, while someone plans for the group, so the search doesn't offer a time
 * filled since the hourly sync (_shared/groupRefresh.ts).
 */
import { requireCaller } from "../_shared/auth.ts";
import { allowedFrontends, inviteFrontend } from "../_shared/frontend.ts";
import { claimStaleConnections, freshForMs, refreshTargets } from "../_shared/groupRefresh.ts";
import {
  cleanDisplayName,
  cleanGroupName,
  displayNameFor,
  INVITE_LIFETIME_MS,
  inviteUrl,
  isMember,
  newInviteToken,
  readInvitees,
  requireMember,
  cleanGroupDescription,
} from "../_shared/groups.ts";
import { afterResponse, HttpError, readRange, requireString, serve } from "../_shared/http.ts";
import {
  blockPerson,
  fileReport,
  listBlocked,
  readReport,
  unblockPerson,
} from "../_shared/safety.ts";
import { calendarStatus } from "../_shared/calendarStatus.ts";
import { encryptionKeyFromEnv, lookupHash } from "../_shared/secretBox.ts";
import { deletePictures, groupPicturePath } from "../_shared/pictures.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncConnection } from "../_shared/sync.ts";
import { rememberName, membersAsMember, listGroups, whoAmI } from "./members.ts";
import { resolveInvitees, sendInvites, listInvitations, findInvite } from "./invitations.ts";
import { groupBusy } from "./busy.ts";

/**
 * Everyone's busy blocks in a group, for a window, grouped by person.
 *
 * Only the time ranges cross over: which calendar a block came from, and what
 * that calendar is called, stay with their owner. So a member sees when you
 * are busy, never that it was "Work" or "Dentist".
 */
serve("groups", async (req, body) => {
  const action = requireString(body, "action");
  const db = supabaseAdmin();

  // Previewing an invite is the one thing that happens before signing in:
  // the link itself is the only thing proving you were meant to see it.
  if (action === "preview") {
    const { groupId, groupName, groupDescription } = await findInvite(db, body.token);
    const { count, error } = await db
      .from("group_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if (error) throw error;
    return {
      group: {
        id: groupId,
        name: groupName,
        description: groupDescription,
        memberCount: count ?? 0,
      },
    };
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
      return await whoAmI(db, profileId, callerName);

    // Everything a page asks for as it opens, in one call (#158): who you are,
    // your groups, your invitations, your calendar accounts and the live pulse, worked out side by
    // side. Each is also its own action, for asking again later.
    case "start": {
      const [whoami, groups, invitations, connections, pulse] = await Promise.all([
        whoAmI(db, profileId, callerName),
        listGroups(db, profileId, callerName),
        listInvitations(db, profileId),
        calendarStatus(db, profileId),
        db.rpc("live_pulse", { p_profile_id: profileId }).then(({ data, error }) => {
          if (error) throw error;
          return data as string;
        }),
      ]);
      return { whoami, groups, invitations, connections, pulse };
    }

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
      const description = cleanGroupDescription(body.description);
      const { data: group, error: groupErr } = await db
        .from("friend_groups")
        .insert({ name, description, created_by: profileId })
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

    case "report":
      await fileReport(db, profileId, readReport(body));
      return { reported: true };

    case "block":
      await blockPerson(db, profileId, body);
      return {
        blocked: await listBlocked(db, profileId),
        invitations: await listInvitations(db, profileId),
      };

    case "unblock":
      await unblockPerson(db, profileId, requireString(body, "profileId"));
      return { blocked: await listBlocked(db, profileId) };

    case "blocked":
      return { blocked: await listBlocked(db, profileId) };

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

    // What the group is for (#152): any member may change it, as with its
    // name; empty removes it.
    case "describe": {
      const groupId = requireString(body, "groupId");
      const description = cleanGroupDescription(body.description);
      await requireMember(db, groupId, profileId);
      const { error } = await db.from("friend_groups").update({ description }).eq("id", groupId);
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
      // The app says so itself (`app: true`): see inviteFrontend.
      const origin = inviteFrontend(
        req.headers.get("Origin"),
        body.app === true,
        allowedFrontends(),
      );
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
      const picture = await groupPicturePath(db, groupId);
      const { data: outcome, error } = await db.rpc("leave_friend_group", {
        p_group_id: groupId,
        p_profile_id: profileId,
      });
      if (error) throw error;
      if (outcome === "not_a_member") throw new HttpError(403, "You are not in that group.");
      // The group went with its last member: its picture too (#188).
      if (outcome === "group_deleted") await deletePictures(db, [picture]);
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
      // friend_groups migration's foreign keys); its picture (#188) is a file
      // they can't reach.
      const picture = await groupPicturePath(db, groupId);
      const { error } = await db.from("friend_groups").delete().eq("id", groupId);
      if (error) throw error;
      await deletePictures(db, [picture]);
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
