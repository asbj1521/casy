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
