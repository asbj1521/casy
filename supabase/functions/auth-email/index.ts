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
 */
import { renderAuthEmails, type EmailData, type HookUser } from "../_shared/authEmails.ts";
import { requireEnv } from "../_shared/env.ts";
import { sendEmail } from "../_shared/resend.ts";
import { signedHeaders, verifyWebhook } from "../_shared/webhookSignature.ts";

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const failure = (status: number, message: string) =>
  answer(status, { error: { http_code: status, message } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return failure(405, "Use POST");
  const body = await req.text();
  const headers = signedHeaders(req.headers);

  let type = "unknown";
  try {
    if (!(await verifyWebhook(requireEnv("SEND_EMAIL_HOOK_SECRET"), headers, body))) {
      return failure(401, "Invalid signature");
    }
    const { user, email_data } = JSON.parse(body) as { user: HookUser; email_data: EmailData };
    type = email_data.email_action_type;

    const emails = renderAuthEmails(user, email_data, requireEnv("SUPABASE_URL"));
    if (emails.length === 0) throw new Error("no address to send to");
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
