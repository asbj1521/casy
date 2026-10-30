/**
 * Admin mode, backed by the `admin` Edge Function.
 *
 * Whether someone is an admin is decided on the server (the ADMIN_USER_IDS
 * secret). The page only asks, so it knows whether to show the button; every
 * admin action is checked again by the function, so hiding the button is not
 * what keeps anyone else out.
 */
import { queryOptions } from "@tanstack/react-query";

import type { EventLabel } from "@/api/eventLabels";
import { callFunction } from "@/lib/supabaseFunctions";
import type { CalendarProvider } from "@/types";
import { currentMessages } from "@/i18n/current";

interface AdminStats {
  users: number;
  groups: number;
  connectedAccounts: number;
  failingSyncs: number;
  busyBlocks: number;
}

export interface AdminGroup {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  members: { profileId: string; name: string; joinedAt: string }[];
}

export interface AdminUser {
  id: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  groups: number;
  calendars: number;
  /** AI while it is tested (#111): admins always, others once switched on here. */
  /** Missing from a function deployed before #111. */
  ai?: "admin" | "allowed" | "off";
  /** An AI tester: every admin-only AI feature. Always for admins, else switched on here. */
  tester?: boolean;
}

export interface AdminConnection {
  id: string;
  ownerId: string;
  ownerName: string;
  provider: CalendarProvider;
  status: "pending" | "connected" | "error";
  calendars: number;
  createdAt: string;
  lastSyncedAt: string | null;
  lastSyncAttemptAt: string | null;
  syncError: string | null;
  needsReconnect: boolean;
}

export interface AdminOverview {
  /** Whether calendar syncing works, as the health function tells the uptime monitor. */
  health: { ok: true } | { ok: false; reason: "stale" | "failing" };
  /** The AI's use per skill, and today's total against the ceiling (#111). */
  ai: {
    today: number;
    limit: number;
    /** Missing from a function deployed before #111. */
    skills?: {
      skill: string;
      today: number;
      last30Days: number;
      /** Estimated from list prices, in dollars. */
      costToday: number;
      cost30Days: number;
    }[];
  } | null;
  stats: AdminStats;
  groups: AdminGroup[];
  users: AdminUser[];
  /** True if there were more accounts than the function reads in one go. */
  usersTruncated: boolean;
  connections: AdminConnection[];
}

export function adminOverviewKey(userId: string) {
  return ["admin-overview", userId] as const;
}

/** Everything admin mode shows. */
export function adminOverviewQuery(userId: string) {
  return queryOptions({
    queryKey: adminOverviewKey(userId),
    queryFn: () =>
      callFunction<AdminOverview>("admin", {
        body: { action: "overview" },
        errorMessage: currentMessages().api.loadAdmin,
      }),
    staleTime: 30_000,
  });
}

export async function adminDeleteGroup(groupId: string): Promise<{ outcome: "deleted" }> {
  return await callFunction("admin", {
    body: { action: "deleteGroup", groupId },
    errorMessage: currentMessages().api.adminDeleteGroup,
  });
}

/** `outcome` is "group_deleted" when that was the group's last member. */
export async function adminRemoveMember(args: {
  groupId: string;
  profileId: string;
}): Promise<{ outcome: "left" | "group_deleted" }> {
  return await callFunction("admin", {
    body: { action: "removeMember", ...args },
    errorMessage: currentMessages().api.adminRemoveMember,
  });
}

/**
 * Delete an account and everything it owns. Groups they were alone in are
 * deleted too; groups with other members carry on without them.
 */
export async function adminDeleteUser(
  profileId: string,
): Promise<{ outcome: "deleted"; leftGroups: number; deletedGroups: number }> {
  return await callFunction("admin", {
    body: { action: "deleteUser", profileId },
    errorMessage: currentMessages().api.adminDeleteAccount,
  });
}

/** Switch the AI features on or off for someone who isn't an admin (#111). */
export async function adminSetAiAccess(
  profileId: string,
  allowed: boolean,
): Promise<{ ai: "allowed" | "off" }> {
  return await callFunction("admin", {
    body: { action: "setAiAccess", profileId, allowed },
    errorMessage: currentMessages().api.adminAiAccess,
  });
}

/**
 * A correction of the AI someone sent to Casy for review (#122): what it says,
 * never whose it is. `data` is checked on the server (_shared/feedback.ts); a
 * "label" one is a label correction: the event's title and calendar, the
 * label the AI gave, what the person wrote, and the label that came of it.
 */
export interface AdminCorrection {
  id: string;
  kind: "label" | "plan";
  data: unknown;
  createdAt: string;
}

export interface LabelCorrectionView {
  title: string;
  calendar: string;
  previous: EventLabel;
  note: string;
  label: EventLabel;
}

export function adminCorrectionsKey(userId: string) {
  return ["admin-corrections", userId] as const;
}

/** The corrections of the AI sent for review, newest first (#122). */
export function adminCorrectionsQuery(userId: string) {
  return queryOptions({
    queryKey: adminCorrectionsKey(userId),
    queryFn: async () =>
      (
        await callFunction<{ corrections: AdminCorrection[] }>("admin", {
          body: { action: "corrections" },
          errorMessage: currentMessages().api.loadAdmin,
        })
      ).corrections,
    staleTime: 30_000,
  });
}

/** One reviewed: its lesson is in the prompt or the evals now, so it is deleted (#122). */
export async function adminCorrectionHandled(id: string): Promise<{ outcome: "handled" }> {
  return await callFunction("admin", {
    body: { action: "correctionHandled", id },
    errorMessage: currentMessages().api.adminAiAccess,
  });
}

/** A report of what someone wrote (#142): what, why and the text as it was, never who sent it. */
export interface AdminReport {
  id: string;
  kind: "group" | "event" | "member";
  reason: string;
  note: string | null;
  content: {
    groupName?: string;
    groupDescription?: string | null;
    title?: string;
    place?: string;
    note?: string;
    memberName?: string;
    memberId?: string;
  };
  /** The reported member's picture as it was (#187), linked; null for none. */
  pictureUrl?: string | null;
  /** Null once the group is gone. */
  groupId: string | null;
  createdAt: string;
}

export function adminReportsKey(userId: string) {
  return ["admin-reports", userId] as const;
}

/** The reports, newest first (#142). */
export function adminReportsQuery(userId: string) {
  return queryOptions({
    queryKey: adminReportsKey(userId),
    queryFn: async () =>
      (
        await callFunction<{ reports: AdminReport[] }>("admin", {
          body: { action: "reports" },
          errorMessage: currentMessages().api.loadReports,
        })
      ).reports,
    staleTime: 30_000,
  });
}

/** A reported member's profile picture taken down (#187). */
export async function adminRemoveAvatar(memberId: string): Promise<{ outcome: "removed" }> {
  return await callFunction("admin", {
    body: { action: "removeAvatar", memberId },
    errorMessage: currentMessages().pictures.removeFailed,
  });
}

/** A reported group's picture taken down (#188). */
export async function adminRemoveGroupPicture(groupId: string): Promise<{ outcome: "removed" }> {
  return await callFunction("admin", {
    body: { action: "removeGroupPicture", groupId },
    errorMessage: currentMessages().pictures.removeFailed,
  });
}

/** One dealt with: deleted (#142). */
export async function adminReportHandled(id: string): Promise<{ outcome: "handled" }> {
  return await callFunction("admin", {
    body: { action: "reportHandled", id },
    errorMessage: currentMessages().api.loadReports,
  });
}

/** Mark someone who has AI on as an AI tester, or not. */
export async function adminSetAiTester(
  profileId: string,
  allowed: boolean,
): Promise<{ tester: boolean }> {
  return await callFunction("admin", {
    body: { action: "setAiTester", profileId, allowed },
    errorMessage: currentMessages().api.adminAiAccess,
  });
}

/** A test notification to the admin's own phones (#139): how many got it, and Apple's reasons for the rest. */
export async function adminPushTest(
  lang: "da" | "en",
): Promise<{ sent: number; failed: string[] }> {
  return await callFunction("admin", {
    body: { action: "pushTest", lang },
    errorMessage: currentMessages().push.failed,
  });
}

/** Re-sync every connected calendar account of one person. */
export async function adminSyncUser(
  userId: string,
): Promise<{ synced: number; failed: number; busyBlocks: number }> {
  return await callFunction("admin", {
    body: { action: "syncUser", userId },
    errorMessage: currentMessages().api.adminSync,
  });
}

export async function adminSyncConnection(
  connectionId: string,
): Promise<{ ok: boolean; message?: string; busyBlocks?: number }> {
  return await callFunction("admin", {
    body: { action: "syncConnection", connectionId },
    errorMessage: currentMessages().api.adminSync,
  });
}
