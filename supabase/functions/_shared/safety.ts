/**
 * Report and block (#142, App Store guideline 1.2), for the groups function.
 *
 * A report is about something the reporter can see: their group's name, an
 * event in it, or a member's name. The copy of the reported text is read here
 * from the database, never taken from the request, so it is what was really
 * there. Admin mode lists reports without the reporter (admin/index.ts).
 *
 * A block stops one person's invitations reaching another, quietly (the
 * send_group_invitations function skips them as it skips members), and
 * deletes the pending ones at once. Someone can only block a person they know:
 * a member of a group they share, or whoever sent them an invitation.
 */
import { isMember, requireMember } from "./groups.ts";
import { HttpError, requireString } from "./http.ts";
import type { Db } from "./supabaseAdmin.ts";
import { cleanText } from "./text.ts";

export const REPORT_KINDS = ["group", "event", "member"] as const;
export const REPORT_REASONS = ["spam", "offensive", "harassment", "other"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

/** At most this many reports a person sends in a day: enough for real use, not for flooding. */
export const MAX_REPORTS_PER_DAY = 20;
export const MAX_REPORT_NOTE_LENGTH = 500;

export interface ReportRequest {
  kind: ReportKind;
  groupId: string;
  eventId: string | null;
  memberId: string | null;
  reason: ReportReason;
  note: string | null;
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** A report as asked for, checked; what it names is checked against the database later. */
export function readReport(body: Record<string, unknown>): ReportRequest {
  const kind = body.kind;
  const reason = body.reason;
  if (!isOneOf(REPORT_KINDS, kind)) throw new HttpError(400, "kind must be group, event or member");
  if (!isOneOf(REPORT_REASONS, reason)) throw new HttpError(400, "Pick a reason.");
  return {
    kind,
    groupId: requireString(body, "groupId"),
    eventId: kind === "event" ? requireString(body, "eventId") : null,
    memberId: kind === "member" ? requireString(body, "memberId") : null,
    reason,
    note: cleanText(body.note, MAX_REPORT_NOTE_LENGTH),
  };
}

/** What the report is about, as the database holds it now. */
async function reportedContent(db: Db, r: ReportRequest): Promise<Record<string, unknown>> {
  const { data: group, error } = await db
    .from("friend_groups")
    .select("name, description, picture_path")
    .eq("id", r.groupId)
    .maybeSingle();
  if (error) throw error;
  if (!group) throw new HttpError(404, "That group no longer exists.");
  // Its picture as it was (#188): admin mode shows it and can remove it.
  if (r.kind === "group") {
    return {
      groupName: group.name,
      groupDescription: group.description,
      picturePath: group.picture_path ?? null,
    };
  }

  if (r.kind === "event") {
    const { data: event, error: eventErr } = await db
      .from("event_proposals")
      .select("title, place, note")
      .eq("id", r.eventId)
      .eq("group_id", r.groupId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!event) throw new HttpError(404, "That event no longer exists.");
    return { groupName: group.name, title: event.title, place: event.place, note: event.note };
  }

  if (!(await isMember(db, r.groupId, r.memberId!))) {
    throw new HttpError(403, "They are not in that group.");
  }
  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", r.memberId)
    .maybeSingle();
  if (profileErr) throw profileErr;
  // Their picture as it was (#187): admin mode shows it and can remove it.
  return {
    groupName: group.name,
    memberName: profile?.display_name ?? null,
    memberId: r.memberId,
    avatarPath: profile?.avatar_path ?? null,
  };
}

/** Files a report from a member of the group, within the day's limit. */
export async function fileReport(db: Db, reporterId: string, r: ReportRequest): Promise<void> {
  await requireMember(db, r.groupId, reporterId);
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count, error: countErr } = await db
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", reporterId)
    .gte("created_at", since);
  if (countErr) throw countErr;
  if ((count ?? 0) >= MAX_REPORTS_PER_DAY) {
    throw new HttpError(429, "You have sent a lot of reports today. Try again tomorrow.");
  }
  const content = await reportedContent(db, r);
  const { error } = await db.from("content_reports").insert({
    reporter_id: reporterId,
    kind: r.kind,
    group_id: r.groupId,
    event_id: r.eventId,
    member_id: r.memberId,
    reason: r.reason,
    note: r.note,
    content,
  });
  if (error) throw error;
}

/** Whether two people are in a group together. */
async function shareAGroup(db: Db, a: string, b: string): Promise<boolean> {
  const { data, error } = await db.from("group_members").select("group_id").eq("profile_id", a);
  if (error) throw error;
  const groups = (data ?? []).map((row) => row.group_id as string);
  if (groups.length === 0) return false;
  const { count, error: bothErr } = await db
    .from("group_members")
    .select("group_id", { count: "exact", head: true })
    .eq("profile_id", b)
    .in("group_id", groups);
  if (bothErr) throw bothErr;
  return (count ?? 0) > 0;
}

/**
 * Blocks a person: `profileId`, someone the blocker shares a group with, or
 * whoever sent the blocker's open invitation to `invitationGroupId` (which is
 * declined with it). Their pending invitations to the blocker are deleted.
 */
export async function blockPerson(
  db: Db,
  blockerId: string,
  body: Record<string, unknown>,
): Promise<void> {
  let blockedId: string | null;
  if (typeof body.invitationGroupId === "string") {
    const { data, error } = await db
      .from("group_invitations")
      .select("invited_by")
      .eq("group_id", body.invitationGroupId)
      .eq("profile_id", blockerId)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "That invitation is no longer open.");
    blockedId = data.invited_by as string | null;
    const { error: declineErr } = await db
      .from("group_invitations")
      .update({ status: "declined" })
      .eq("group_id", body.invitationGroupId)
      .eq("profile_id", blockerId);
    if (declineErr) throw declineErr;
    // The sender's account is gone: declining was all there was to do.
    if (!blockedId) return;
  } else {
    blockedId = requireString(body, "profileId");
    if (blockedId === blockerId) throw new HttpError(400, "You can't block yourself.");
    if (!(await shareAGroup(db, blockerId, blockedId))) {
      throw new HttpError(403, "You can only block someone you share a group with.");
    }
  }

  const { error } = await db
    .from("blocked_people")
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  if (error) throw error;
  const { error: cleanErr } = await db
    .from("group_invitations")
    .delete()
    .eq("profile_id", blockerId)
    .eq("invited_by", blockedId)
    .eq("status", "pending");
  if (cleanErr) throw cleanErr;
}

export async function unblockPerson(db: Db, blockerId: string, blockedId: string): Promise<void> {
  const { error } = await db
    .from("blocked_people")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

/** Who the person has blocked, newest first, by the names they go by. */
export async function listBlocked(
  db: Db,
  blockerId: string,
): Promise<{ profileId: string; name: string | null; blockedAt: string }[]> {
  const { data, error } = await db
    .from("blocked_people")
    .select("blocked_id, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: profiles, error: namesErr } = await db
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      rows.map((r) => r.blocked_id),
    );
  if (namesErr) throw namesErr;
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
  return rows.map((r) => ({
    profileId: r.blocked_id as string,
    name: names.get(r.blocked_id as string) ?? null,
    blockedAt: r.created_at as string,
  }));
}
