/**
 * How many auth emails Casy sends, in place of a CAPTCHA (#203). The sign-in
 * page must work with any ad blocker, so nothing here runs in the browser:
 * the auth-email hook asks before each email that anyone could make Casy
 * send (signing up, a sign-in link, a password reset), and those beyond the
 * share are refused with the reason in the person's language. Supabase's own
 * per-IP limits (config.toml, [auth.rate_limit]) still apply before the hook.
 *
 * Only an HMAC of the address is stored (claim_auth_email, the
 * auth_email_limits migration), for a day.
 */
import type { Lang } from "./i18n.ts";
import type { Db } from "./supabaseAdmin.ts";

/** Emails to one address, per hour and per day. */
export const PER_ADDRESS_PER_HOUR = 5;
export const PER_ADDRESS_PER_DAY = 10;
/** Emails to everyone together, per hour: a spray at many addresses stops here. */
export const ALL_PER_HOUR = 30;
/**
 * And per day (#235), under the 100 a day of Resend's free plan, so a busy day
 * still leaves room for the emails that are never limited. Raise it with the plan.
 */
export const ALL_PER_DAY = 80;

/**
 * The kinds anyone can ask for with only an address. The rest need a
 * signed-in person (reauthentication, email_change) or tell someone about a
 * change to their account (the notifications), and a flood must never hold
 * those back.
 */
const LIMITED = new Set(["signup", "magiclink", "recovery"]);

export function isLimited(type: string): boolean {
  return LIMITED.has(type);
}

/**
 * The address as stored: HMAC-SHA256 with `secret` (the hook's own), hex,
 * of the address trimmed and in lower case, so one address is one key
 * whatever its spelling, and the key can't be turned back into it.
 */
export async function recipientKey(secret: string, address: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(address.trim().toLowerCase()),
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Verdict = "ok" | "address" | "all";

/** Count one email to `recipient` (a key from recipientKey), if its share allows. */
export async function claimAuthEmail(db: Db, recipient: string): Promise<Verdict> {
  const { data, error } = await db.rpc("claim_auth_email", {
    p_recipient: recipient,
    p_per_hour: PER_ADDRESS_PER_HOUR,
    p_per_day: PER_ADDRESS_PER_DAY,
    p_all_per_hour: ALL_PER_HOUR,
    p_all_per_day: ALL_PER_DAY,
  });
  if (error) throw error;
  return verdictOf(data);
}

/** The database's answer as a verdict; anything unexpected is a failure. */
export function verdictOf(answer: unknown): Verdict {
  const claim = answer as { ok?: boolean; exhausted?: string } | null;
  if (claim?.ok === true) return "ok";
  if (claim?.exhausted === "address" || claim?.exhausted === "all") return claim.exhausted;
  throw new Error("claim_auth_email gave no verdict");
}

/** What the page shows when an email is refused, in the email's language. */
export function refusal(verdict: "address" | "all", lang: Lang): string {
  if (verdict === "address") {
    return lang === "da"
      ? "Der er sendt mange e-mails til den adresse den seneste tid. Vent en time, og prøv igen."
      : "Many emails have gone to that address lately. Wait an hour and try again.";
  }
  return lang === "da"
    ? "Casy sender mange e-mails lige nu. Prøv igen senere."
    : "Casy is sending a lot of emails right now. Try again later.";
}
