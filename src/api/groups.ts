/**
 * Real friend groups, backed by the `groups` Edge Function.
 *
 * This replaces the generated groups in mockData.ts as the source of who you
 * schedule with. The generated ones stay on as a clearly labelled example for
 * anyone who has not made a group yet, so an empty account still has
 * something to look at.
 *
 * Nothing here says who is calling: the function takes that from the login
 * token the call carries. A group id in one of these requests only gets you
 * as far as your membership already does.
 */
import { queryOptions } from "@tanstack/react-query";

import { withHolidayBlocks } from "@/lib/holidayBlocks";
import { callFunction } from "@/lib/supabaseFunctions";
import { APP_TIME_ZONE } from "@/lib/zone";
import type { BusyInterval, EventCategory } from "@/types";
import { currentMessages } from "@/i18n/current";

/** One person in a group, as other members see them: a name, nothing more. */
export interface GroupMember {
  profileId: string;
  name: string;
  /** True for the signed-in person, so the list can say "you". */
  isYou: boolean;
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
  /**
   * Whoever made the group — null if their account is gone (created_by is set
   * null on delete, see the migration). Grants nothing except the ability to
   * delete the group outright; every other action is open to any member.
   */
  createdBy: string | null;
  members: GroupMember[];
  /**
   * People invited who haven't joined, as profile ids, but only those you
   * already share a group with (the function leaves out anyone else). A "no
   * thanks" still reads as invited here: declining is never reported back.
   */
  invited: string[];
}

/** Who to invite: people picked from your groups, and email addresses. */
export interface Invitees {
  profileIds: string[];
  emails: string[];
}

/** An invitation waiting for your answer. */
export interface Invitation {
  groupId: string;
  groupName: string;
  memberCount: number;
  /** Who invited you; null if their account has since been deleted. */
  invitedBy: string | null;
  createdAt: string;
}

/** What the group's members are busy with, as far as anyone else may know. */
export interface GroupBusy {
  /** Busy blocks per member id. A member with no calendar linked has none. */
  busy: Record<string, { start: string; end: string; category?: EventCategory }[]>;
  /** Whether each member has a working calendar at all. */
  connected: Record<string, boolean>;
  /**
   * Members whose calendar hasn't been updated for two days or more, and when
   * it last was (ISO). Their busy times still count. Missing from answers
   * cached before it existed.
   */
  outdated?: Record<string, string>;
  /** True if the backend stopped early because there were too many blocks. */
  truncated: boolean;
}

/**
 * The cache key for a person's groups, shared by every place that reads or
 * writes it (the query itself, and any mutation that hands back a fresh
 * group list) so a successful create/join/leave/delete can update the cache
 * directly instead of triggering a refetch.
 */
export function groupsQueryKey(userId: string) {
  return ["groups", userId] as const;
}

/**
 * Your groups. `userId` only keys the cache so one person's answer is never
 * served to the next; the function itself learns who is asking from the token.
 */
export function groupsQuery(userId: string) {
  return queryOptions({
    queryKey: groupsQueryKey(userId),
    queryFn: async (): Promise<Group[]> => {
      const body = await callFunction<{ groups?: Group[] }>("groups", {
        body: { action: "list" },
        errorMessage: currentMessages().api.loadGroups,
      });
      return body.groups ?? [];
    },
    staleTime: 60_000,
  });
}

/** Everyone's busy time in one group, across the scheduling search window. */
export function groupBusyQuery(userId: string, groupId: string | null, from: string, to: string) {
  return queryOptions({
    queryKey: ["group-busy", userId, groupId, from, to],
    queryFn: async (): Promise<GroupBusy> =>
      await callFunction<GroupBusy>("groups", {
        body: { action: "busy", groupId, from, to },
        errorMessage: currentMessages().api.loadGroupCalendars,
      }),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}

/**
 * Sync the members' calendars that haven't been for a while (the groups
 * function's `refresh`), so the next search uses fresh busy times. Answers
 * within about 10 seconds: `complete` is false if some syncs were still
 * running then (they finish on the server anyway), `synced` whether any
 * account was due at all.
 */
export async function refreshGroupCalendars(
  groupId: string,
  /** How recently an account must have synced to be left alone (the server keeps it to 1-10 min). */
  freshForSeconds: number,
): Promise<{ complete: boolean; synced: boolean }> {
  return await callFunction("groups", {
    body: { action: "refresh", groupId, freshForSeconds },
  });
}

/** A new group, with invitations to whoever is named (nobody, if no one is). */
export async function createGroup({
  name,
  invitees,
}: {
  name: string;
  invitees?: Invitees;
}): Promise<{ groups: Group[]; createdId: string }> {
  return await callFunction("groups", {
    body: { action: "create", name, ...invitees },
    errorMessage: currentMessages().api.createGroup,
  });
}

/**
 * Invite people to a group you're in. The answer never says which emails
 * matched an account: that is the invited person's business.
 */
export async function inviteMembers(
  groupId: string,
  invitees: Invitees,
): Promise<{ groups: Group[] }> {
  return await callFunction("groups", {
    body: { action: "invite-members", groupId, ...invitees },
    errorMessage: currentMessages().api.inviteMembers,
  });
}

export function invitationsQueryKey(userId: string) {
  return ["invitations", userId] as const;
}

/** Invitations to groups, waiting for your yes or no. */
export function invitationsQuery(userId: string) {
  return queryOptions({
    queryKey: invitationsQueryKey(userId),
    queryFn: async (): Promise<Invitation[]> => {
      const body = await callFunction<{ invitations?: Invitation[] }>("groups", {
        body: { action: "invitations" },
        errorMessage: currentMessages().api.loadInvitations,
      });
      return body.invitations ?? [];
    },
    staleTime: 60_000,
  });
}

/**
 * A short fingerprint of everything that can change for you (groups,
 * invitations, events and answers): different whenever any of it changed.
 * How often it is asked is up to useLiveUpdates (lib/livePace.ts); it is
 * asked at once when you come back to the tab, never while the tab is hidden.
 */
export function pulseQuery(userId: string) {
  return queryOptions({
    queryKey: ["pulse", userId],
    queryFn: async (): Promise<string> => {
      const body = await callFunction<{ pulse: string }>("groups", { body: { action: "pulse" } });
      return body.pulse;
    },
    staleTime: 0,
    // A missed beat is simply asked again on the next one.
    retry: false,
  });
}

/** Join the group you were invited to. */
export async function acceptInvitation(
  groupId: string,
): Promise<{ groups: Group[]; invitations: Invitation[]; joinedId: string }> {
  return await callFunction("groups", {
    body: { action: "accept-invitation", groupId },
    errorMessage: currentMessages().api.answerInvitation,
  });
}

/** Say no thanks. Whoever invited you isn't told. */
export async function declineInvitation(groupId: string): Promise<{ invitations: Invitation[] }> {
  return await callFunction("groups", {
    body: { action: "decline-invitation", groupId },
    errorMessage: currentMessages().api.answerInvitation,
  });
}

/** The signed-in person: what to call them, and whether AI is on for them (#111). */
export interface WhoAmI {
  name: string;
  /** Missing in answers from before #111 (a remembered copy): read as off. */
  aiAllowed?: boolean;
}

/** The cache key for the signed-in person's resolved display name. */
export function whoAmIQueryKey(userId: string) {
  return ["whoami", userId] as const;
}

/**
 * What to call the signed-in person: their chosen name if they set one on
 * the profile page, otherwise the name their login hands over (a Google name,
 * or the part of an email before the @).
 */
export function whoAmIQuery(userId: string) {
  return queryOptions({
    queryKey: whoAmIQueryKey(userId),
    queryFn: async (): Promise<WhoAmI> =>
      await callFunction<WhoAmI>("groups", {
        body: { action: "whoami" },
        errorMessage: currentMessages().api.loadProfile,
      }),
    staleTime: 60_000,
  });
}

/** Set a custom display name, shown to group members instead of the login-derived one. */
export async function setDisplayName(name: string): Promise<{ name: string }> {
  return await callFunction("groups", {
    body: { action: "set-name", name },
    errorMessage: currentMessages().api.setName,
  });
}

/** Rename a group. Any member can do this, not just whoever created it. */
export async function renameGroup(groupId: string, name: string): Promise<{ groups: Group[] }> {
  return await callFunction("groups", {
    body: { action: "rename", groupId, name },
    errorMessage: currentMessages().api.renameGroup,
  });
}

/** A fresh invite link. Earlier links for the group keep working until they expire. */
export async function createInvite(groupId: string): Promise<{ url: string; expiresAt: string }> {
  return await callFunction("groups", {
    body: { action: "invite", groupId },
    errorMessage: currentMessages().api.invite,
  });
}

/** The group behind an invite link, for the join page before anyone signs in. */
export async function previewInvite(
  token: string,
): Promise<{ group: { id: string; name: string; memberCount: number } }> {
  return await callFunction("groups", {
    body: { action: "preview", token },
    errorMessage: currentMessages().api.preview,
  });
}

export async function joinGroup(token: string): Promise<{ groups: Group[]; joinedId: string }> {
  return await callFunction("groups", {
    body: { action: "join", token },
    errorMessage: currentMessages().api.joinGroup,
  });
}

/** Leave a group. `outcome` is "group_deleted" when you were the last one in it. */
export async function leaveGroup(
  groupId: string,
): Promise<{ groups: Group[]; outcome: "left" | "group_deleted" }> {
  return await callFunction("groups", {
    body: { action: "leave", groupId },
    errorMessage: currentMessages().api.leaveGroup,
  });
}

/**
 * Delete a group outright, removing it (and everyone's membership) for good.
 * Only the person who created it can do this; anyone else should leave
 * instead.
 */
export async function deleteGroup(
  groupId: string,
): Promise<{ groups: Group[]; outcome: "deleted" }> {
  return await callFunction("groups", {
    body: { action: "delete", groupId },
    errorMessage: currentMessages().api.deleteGroup,
  });
}

/**
 * A real group in the shape the scheduling engine wants: participants each
 * carrying their own busy blocks.
 *
 * A member who has linked no calendar has no blocks, so nothing is known about
 * their time. They aren't searched (which finds the same dates as counting
 * them free, without the chart's "everyone can" claiming them) and are named
 * in `waitingFor`: they check suggested dates themselves and answer on My
 * events, and an event only goes ahead once they say yes (#82).
 *
 * If nobody in the group has a calendar, everyone is searched as free, so the
 * group still gets dates to answer by hand, and a decline still finds the
 * next one, rather than no date at all. While the busy times are still
 * loading (`data` undefined) nobody is searched.
 */
export function participantsFromGroup(
  group: Group,
  data: GroupBusy | undefined,
  /** How to mark you in the list, e.g. "Asbjørn (dig)"; unmarked if omitted. */
  markYou: (name: string) => string = (name) => name,
) {
  const connected = group.members.filter((m) => data?.connected[m.profileId]);
  const searched = connected.length > 0 || !data ? connected : group.members;
  return {
    // With Christmas and New Year blocked for everyone (holidayBlocks.ts):
    // every search of a real group starts here, the scheduler's and a
    // decline's alike.
    participants: withHolidayBlocks(
      searched.map((m) => ({
        profileId: m.profileId,
        name: m.isYou ? markYou(m.name) : m.name,
        busy: (data?.busy[m.profileId] ?? []) as BusyInterval[],
      })),
      APP_TIME_ZONE,
    ),
    /** Members with no calendar linked, who check suggested dates themselves. */
    waitingFor: group.members.filter((m) => !data?.connected[m.profileId]),
    /** Members searched with a calendar that hasn't been updated for days, and since when. */
    outdated: connected.flatMap((m) => {
      const since = data?.outdated?.[m.profileId];
      return since ? [{ member: m, since }] : [];
    }),
  };
}
