/**
 * Sending an email through Resend's API, from noreply@casy.app: the auth
 * emails (auth-email), and later the notifications (#78). The key is
 * RESEND_SEND_KEY, a Resend API key with sending access only, kept apart from
 * RESEND_API_KEY (the dashboard's SMTP password, never a function secret).
 */

export const FROM = "Casy <noreply@casy.app>";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send one email. `idempotencyKey` makes Resend send it once however often
 * this is called with the same key (for 24 hours), so a retried request
 * can't send a second copy. Throws if Resend refused; the error never holds
 * the address.
 */
export async function sendEmail(
  apiKey: string,
  email: OutgoingEmail,
  idempotencyKey: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const name = (detail as { name?: string }).name ?? "unknown";
    throw new Error(`Resend refused the email: HTTP ${res.status} (${name})`);
  }
}
