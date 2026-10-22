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
 * operator's own test account, for one) gets each of them. Features that read
 * calendar content check aiContentAllowed instead, which also lets in whoever
 * has said yes (#120).
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

/**
 * The wording of the yes people give to Casy's AI using content from their
 * calendar (#120): the names of their calendars and the titles of their
 * events. Raised whenever the AI may do more with it (day scores shared for
 * ranking, #119), which asks everyone again: a yes under an older number
 * counts as none. Keep it in step with the privacy policy's AI section.
 */
export const CONSENT_VERSION = 1;

/** Say yes under the current wording, or take the yes back (the row goes). */
export async function setAiConsent(
  db: Pick<Db, "from">,
  profileId: string,
  on: boolean,
): Promise<void> {
  const { error } = on
    ? await db
        .from("ai_consent")
        .upsert(
          { profile_id: profileId, version: CONSENT_VERSION, given_at: new Date().toISOString() },
          { onConflict: "profile_id" },
        )
    : await db.from("ai_consent").delete().eq("profile_id", profileId);
  if (error) throw error;
}

/** Whether this person has said yes, under the current wording. */
export async function aiConsented(db: Pick<Db, "from">, profileId: string): Promise<boolean> {
  const { data, error } = await db
    .from("ai_consent")
    .select("version")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return ((data as { version?: number } | null)?.version ?? 0) >= CONSENT_VERSION;
}

/**
 * Whether Casy's AI may read content from this person's calendar (names,
 * event titles): the AI is on for them, and they have said yes, or they are
 * an admin or AI tester, who may while it is tested. Event labels and
 * calendar sorting ask this; Planning with AI does not, since it sends only
 * what the person types or says.
 */
export async function aiContentAllowed(db: Pick<Db, "from">, profileId: string): Promise<boolean> {
  if (!(await aiAllowed(db, profileId))) return false;
  return (await aiTesterAllowed(db, profileId)) || (await aiConsented(db, profileId));
}

/** Refused before anything is read, claimed or asked. */
export const CONTENT_NOT_ALLOWED = "Casy's AI needs your yes before it reads your calendar.";
