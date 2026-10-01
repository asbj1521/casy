/**
 * The rules for groups that the groups and events functions share: invite
 * tokens, the names people type, what a member is called, and who counts as
 * one. Everything but the membership check is free of the database, so it
 * can be checked with plain unit tests.
 */
import { encodeBase64Url } from "jsr:@std/encoding@1/base64url";

import { HttpError } from "./http.ts";
import type { Db } from "./supabaseAdmin.ts";
import { cleanText } from "./text.ts";

/** How long a freshly made invite link keeps working. */
export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Longest group name we keep, matching the check constraint on the table. */
export const MAX_GROUP_NAME_LENGTH = 60;

/** Longest custom display name we keep. */
export const MAX_DISPLAY_NAME_LENGTH = 40;

/**
 * A fresh invite token: 32 random bytes in URL-safe base64.
 *
 * It ends up in a link people paste into chats, so it must survive a URL
 * untouched (no "+", "/" or "="), and it must be unguessable: 256 bits of
 * randomness means nobody finds a live invite by trying.
 */
export function newInviteToken(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Is this string shaped like one of our tokens? Checked before the database
 * is asked anything, so a junk URL costs no query.
 */
export function looksLikeInviteToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

/** The link to send someone, for a site we already decided is allowed. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin}/join/${token}`;
}

/** A group name as it should be stored, or null if nothing is left of it. */
export function cleanGroupName(raw: unknown): string | null {
  return cleanText(raw, MAX_GROUP_NAME_LENGTH);
}

/** A display name as a person typed it, cleaned up the same way a group name is. */
export function cleanDisplayName(raw: unknown): string | null {
  return cleanText(raw, MAX_DISPLAY_NAME_LENGTH);
}

/** The shape of an auth user, as much of it as naming someone needs. */
export interface NameableUser {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * What to call someone in a member list.
 *
 * Google hands us a full name, which is what people expect to see. Someone
 * who signed in by email link has no name at all, so the part of their
 * address before the "@" stands in: it is the half they chose, and it keeps
 * the domain (where they work, which provider they use) out of other
 * members' sight. Group members are never shown an email address.
 */
export function displayNameFor(user: NameableUser | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  for (const key of ["full_name", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const local = user?.email?.split("@")[0]?.trim();
  return local || "Someone";
}

/** Most people one request may pick to invite: a group holds 20, the inviter included. */
export const MAX_PICKED_PER_REQUEST = 19;

/** Most email addresses one request may look up. */
export const MAX_EMAILS_PER_REQUEST = 10;

/** Picked people one person may invite in a day; email invitations don't count here. */
export const MAX_PICKED_PER_DAY = 50;

/** Email addresses one person may look up in a day, whether or not they match an account. */
export const MAX_EMAIL_LOOKUPS_PER_DAY = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An email address as accounts store it (trimmed, lower case), or null if it isn't one. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

/** Who a request asks to invite: people picked by id, and email addresses. */
export interface Invitees {
  profileIds: string[];
  emails: string[];
}

/**
 * The invitees a request names, both lists optional. Anything malformed
 * refuses the whole request, so nobody is invited by half of a bad one.
 */
export function readInvitees(body: Record<string, unknown>): Invitees {
  const ids = body.profileIds ?? [];
  const emails = body.emails ?? [];
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && UUID.test(id))) {
    throw new HttpError(400, "profileIds must be a list of ids");
  }
  if (!Array.isArray(emails)) throw new HttpError(400, "emails must be a list");
  const cleaned = emails.map(normalizeEmail);
  if (cleaned.some((e) => e === null)) throw new HttpError(400, "That is not an email address.");

  const profileIds = [...new Set(ids.map((id: string) => id.toLowerCase()))];
  const unique = [...new Set(cleaned as string[])];
  if (profileIds.length > MAX_PICKED_PER_REQUEST || unique.length > MAX_EMAILS_PER_REQUEST) {
    throw new HttpError(400, "That is too many people at once.");
  }
  return { profileIds, emails: unique };
}

/** True if this person is in this group. */
export async function isMember(db: Db, groupId: string, profileId: string): Promise<boolean> {
  const { data, error } = await db
    .from("group_members")
    .select("profile_id")
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Refuses anyone not in the group: holding a group's id proves nothing. */
export async function requireMember(db: Db, groupId: string, profileId: string): Promise<void> {
  if (!(await isMember(db, groupId, profileId))) {
    throw new HttpError(403, "You are not in that group.");
  }
}
