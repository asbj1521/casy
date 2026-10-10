/**
 * Who may use the AI features while they are tested (#111), on its own so
 * that functions which only ask (groups' whoami) don't load Anthropic's SDK.
 */
import { isAdminId } from "./admin.ts";
import type { Db } from "./supabaseAdmin.ts";

/**
 * Whether this person may use the AI features: admins always, everyone else
 * once an admin has switched it on (ai_access). While they are tested, so
 * that nobody else spends the budget.
 */
export async function aiAllowed(db: Pick<Db, "from">, profileId: string): Promise<boolean> {
  if (isAdminId(profileId, Deno.env.get("ADMIN_USER_IDS"))) return true;
  const { data, error } = await db
    .from("ai_access")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Refused before anything is claimed or asked. */
export const NOT_ALLOWED = "AI features aren't switched on for your account yet.";

/**
 * Whether this person gets the AI features that are admin-only while they
 * are tested: admins always, everyone else only once an admin marked them as
 * an AI tester (ai_access.tester), on top of the AI features. Every such
 * feature checks this, never admin status alone, so a tester's account (the
 * operator's own test account, for one) gets each of them. Event labels
 * (#112) are one: they send event titles, which needs #120's consent before
 * anyone else.
 */
export async function aiTesterAllowed(db: Pick<Db, "from">, profileId: string): Promise<boolean> {
  if (isAdminId(profileId, Deno.env.get("ADMIN_USER_IDS"))) return true;
  const { data, error } = await db
    .from("ai_access")
    .select("tester")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return (data as { tester?: boolean } | null)?.tester === true;
}

export const LABELS_NOT_ALLOWED = "Event labels aren't switched on for your account.";
