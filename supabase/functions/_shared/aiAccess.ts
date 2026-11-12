/**
 * Who Casy's AI may work for (#111, #147), on its own so that functions which
 * only ask (groups' whoami) don't load Anthropic's SDK. The AI is there for
 * everyone, and does nothing for anyone until they have said yes.
 */
import { isAdminId } from "./admin.ts";
import type { Db } from "./supabaseAdmin.ts";

/**
 * Whether this person is an admin or AI tester (ai_access.tester): more daily
 * calls, and what is only for testing, such as Your data's diagnostics. Every
 * such thing checks this, never admin status alone, so a tester's account (the
 * operator's own test account, for one) gets each of them.
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
 * The wording of the yes people give to Casy's AI (#120): the names of their
 * calendars and the titles of their events, and since 5 what they write or say
 * to it and the events they plan. Raised whenever the AI may do more with it, which asks everyone
 * again: a yes under an older number counts as none. 2 (#119): the phone also
 * shares, for each important event, when it starts and how much it matters
 * (never its title), so a vote's dates can be ranked for the whole group. 3
 * (#122): corrections of the AI are sent to Casy for review (a label
 * correction with its title, a plan with its text), unless the person switches
 * that off in Your data. 4 (#115): for flights, trains and buses the event's
 * place goes too, so the app can find trips. 5 (#147): one yes for all of the
 * AI, now that it is there for everyone. Keep it in step with the privacy
 * policy's AI section.
 */
export const CONSENT_VERSION = 5;

/**
 * Say yes under the current wording, or take the yes back: the row goes, and
 * so do the facts the person's phone shared for ranking dates (#119) and the
 * corrections they sent for review (#122), which were only shared under the
 * yes. Saying yes again keeps a choice to share no corrections: that switch is
 * the person's own.
 */
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
  if (!on) {
    for (const table of ["ai_day_facts", "ai_corrections"]) {
      const { error: sharedError } = await db.from(table).delete().eq("profile_id", profileId);
      if (sharedError) throw sharedError;
    }
  }
}

/**
 * Switch the sending of corrections to Casy for review (#122) on or off,
 * without touching the yes itself. Only for someone who has said yes: the
 * switch lives on that row. Returns false when there is none.
 */
export async function setAiSharing(
  db: Pick<Db, "from">,
  profileId: string,
  on: boolean,
): Promise<boolean> {
  const { data, error } = await db
    .from("ai_consent")
    .update({ share_corrections: on })
    .eq("profile_id", profileId)
    .select("profile_id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Whether this person's corrections of the AI may be stored for review
 * (#122): they said yes under today's wording, and haven't switched sharing
 * off. Admins and testers need the yes too: sharing is for real use.
 */
export async function aiSharesCorrections(
  db: Pick<Db, "from">,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("ai_consent")
    .select("version, share_corrections")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { version?: number; share_corrections?: boolean } | null;
  return (row?.version ?? 0) >= CONSENT_VERSION && row?.share_corrections === true;
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
 * Whether Casy's AI may work for this person (#147): they have said yes, or
 * they are an admin or AI tester. runSkill asks this before every call, so
 * nothing reaches Anthropic without it.
 */
export async function aiContentAllowed(db: Pick<Db, "from">, profileId: string): Promise<boolean> {
  return (await aiTesterAllowed(db, profileId)) || (await aiConsented(db, profileId));
}

/** Refused before anything is read, claimed or asked. */
export const CONTENT_NOT_ALLOWED = "The AI needs your yes first.";
