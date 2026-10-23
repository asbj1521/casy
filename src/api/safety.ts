/**
 * Report and block (#142): reporting a group, an event or a member to Casy,
 * and blocking a person's invitations. Through the groups function
 * (_shared/safety.ts); admin mode's side is in admin.ts.
 */
import { queryOptions } from "@tanstack/react-query";

import type { Invitation } from "@/api/groups";
import { currentMessages } from "@/i18n/current";
import { callFunction } from "@/lib/supabaseFunctions";

export type ReportReason = "spam" | "offensive" | "harassment" | "other";
export const REPORT_REASONS: ReportReason[] = ["spam", "offensive", "harassment", "other"];

/** What a report is about: a group, an event in it, or a member of it. */
export type ReportTarget =
  | { kind: "group"; groupId: string }
  | { kind: "event"; groupId: string; eventId: string }
  | { kind: "member"; groupId: string; memberId: string };

export async function sendReport(
  target: ReportTarget,
  reason: ReportReason,
  note: string,
): Promise<{ reported: true }> {
  return await callFunction("groups", {
    body: { action: "report", ...target, reason, note },
    errorMessage: currentMessages().api.report,
  });
}

export interface BlockedPerson {
  profileId: string;
  /** Null when their account is gone. */
  name: string | null;
  blockedAt: string;
}

export const blockedQueryKey = (userId: string) => ["blocked", userId] as const;

export function blockedQuery(userId: string) {
  return queryOptions({
    queryKey: blockedQueryKey(userId),
    queryFn: async () =>
      (
        await callFunction<{ blocked: BlockedPerson[] }>("groups", {
          body: { action: "blocked" },
          errorMessage: currentMessages().api.blocked,
        })
      ).blocked,
  });
}

/** Blocks a member of a group you share, or whoever sent your invitation to a group. */
export async function blockPerson(
  who: { profileId: string } | { invitationGroupId: string },
): Promise<{ blocked: BlockedPerson[]; invitations: Invitation[] }> {
  return await callFunction("groups", {
    body: { action: "block", ...who },
    errorMessage: currentMessages().api.blocked,
  });
}

export async function unblockPerson(profileId: string): Promise<{ blocked: BlockedPerson[] }> {
  return await callFunction("groups", {
    body: { action: "unblock", profileId },
    errorMessage: currentMessages().api.blocked,
  });
}
