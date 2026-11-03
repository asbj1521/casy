/**
 * Supabase Auth's "Send Email" hook: Auth calls this instead of sending its
 * own emails, and this sends them in the person's language through Resend
 * (_shared/authEmails.ts for the words, _shared/resend.ts for the sending).
 *
 * Not built on serve() (_shared/http.ts): the caller is Auth, not the site,
 * so there is no CORS and no login. Instead every call must carry Auth's
 * signature, made with the hook's secret (SEND_EMAIL_HOOK_SECRET); anything
 * else is refused. Auth expects `{}` with 200 when the email went, and
 * `{ error: { http_code, message } }` otherwise, which it reports to the
 * page that asked as a failed send.
 *
 * Auth may call again if an answer is slow. Each email is sent with the
 * call's webhook-id as Resend's idempotency key, so a retry never sends a
 * second copy.
 *
 * In place of a CAPTCHA (#203), the emails anyone can ask for with only an
 * address are limited per address and in all (_shared/authEmailLimits.ts);
 * one beyond its share is refused with a 429 the page shows as written.
 */
import {
  claimAuthEmail,
  isLimited,
  recipientKey,
  refusal,
  type Verdict,
} from "../_shared/authEmailLimits.ts";
import {
  emailLang,
  renderAuthEmails,
  type EmailData,
  type HookUser,
} from "../_shared/authEmails.ts";
import { requireEnv } from "../_shared/env.ts";
import { sendEmail } from "../_shared/resend.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { signedHeaders, verifyWebhook } from "../_shared/webhookSignature.ts";

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const failure = (status: number, message: string) =>
  answer(status, { error: { http_code: status, message } });

/**
 * Whether this email is within its share (_shared/authEmailLimits.ts). A
 * limit that can't be checked lets the email go: the limits hold back a
 * flood, and must never stop a real sign-in because of a fault of their own.
 */
async function withinShare(secret: string, address: string, type: string): Promise<Verdict> {
  try {
    return await claimAuthEmail(supabaseAdmin(), await recipientKey(secret, address));
  } catch (err) {
    console.error(`auth-email ${type}: limit unchecked:`, err instanceof Error ? err.message : err);
    return "ok";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return failure(405, "Use POST");
  const body = await req.text();
  const headers = signedHeaders(req.headers);

  let type = "unknown";
  try {
    const secret = requireEnv("SEND_EMAIL_HOOK_SECRET");
    if (!(await verifyWebhook(secret, headers, body))) {
      return failure(401, "Invalid signature");
    }
    const { user, email_data } = JSON.parse(body) as { user: HookUser; email_data: EmailData };
    type = email_data.email_action_type;

    const emails = renderAuthEmails(user, email_data, requireEnv("SUPABASE_URL"));
    if (emails.length === 0) throw new Error("no address to send to");
    // Each address's share of what anyone can ask for (#203), told in the
    // email's language: Auth passes the message to the page as it is.
    if (isLimited(type)) {
      for (const email of emails) {
        const verdict = await withinShare(secret, email.to, type);
        if (verdict !== "ok") return failure(429, refusal(verdict, emailLang(user, email_data)));
      }
    }
    const key = requireEnv("RESEND_SEND_KEY");
    for (const [i, email] of emails.entries()) {
      await sendEmail(key, email, `auth-email/${headers.id}/${i}`);
    }
    return answer(200, {});
  } catch (err) {
    // Logged without the payload: it holds the person's address and tokens.
    console.error(`auth-email ${type} failed:`, err instanceof Error ? err.message : err);
    return failure(500, "The email could not be sent. Please try again.");
  }
});
