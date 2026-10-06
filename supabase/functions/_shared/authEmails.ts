/**
 * The emails Supabase Auth asks Casy to send (the auth-email hook), in Danish
 * or English: confirming an account, signing in, resetting a password, the
 * security code, and the security notices (password changed, and the ones for
 * changed emails, linked sign-ins and two-step sign-in, so they are ready when
 * switched on).
 *
 * Which language: the page's, when the email was asked for (the sign-in page
 * puts `lang` in the address it asks Auth to send people back to), else the
 * language saved on the account (`user_metadata.lang`, kept current by the
 * site), else Danish, the site's own default.
 *
 * Most people who get one of these were invited by a friend and have never
 * heard of Casy, so each email says what Casy is, says how long a link
 * works, and says what to do if it was unexpected: that is what tells a real
 * email from a phishing attempt. The layout is a table with inline styles in
 * the site's colours, which is all email clients reliably understand.
 */
import type { Lang } from "./i18n.ts";

/** The parts of Auth's hook payload these emails read. */
export interface HookUser {
  id: string;
  email?: string;
  new_email?: string;
  user_metadata?: Record<string, unknown>;
}

export interface EmailData {
  token?: string;
  token_hash?: string;
  redirect_to?: string;
  email_action_type: string;
  site_url?: string;
  token_new?: string;
  token_hash_new?: string;
  old_email?: string;
  provider?: string;
  factor_type?: string;
}

/** One email, ready to send. */
export interface AuthEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** The language for this person's email (see the top of the file). */
export function emailLang(user: HookUser, data: EmailData): Lang {
  try {
    const fromPage = new URL(data.redirect_to ?? "").searchParams.get("lang");
    if (fromPage === "da" || fromPage === "en") return fromPage;
  } catch {
    // No address, or not one: fall through to the account's language.
  }
  const saved = user.user_metadata?.lang;
  return saved === "en" ? "en" : "da";
}

/**
 * The one-time link, exactly as Supabase builds its own ConfirmationURL:
 * Auth's verify endpoint, which checks the token and then sends the browser
 * on to `redirect_to`.
 */
export function verifyUrl(
  supabaseUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string,
): string {
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo });
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify?${params}`;
}

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

/** One email's words: a heading, what to do, and the reassurance at the end. */
interface Words {
  subject: string;
  /** The inbox preview line. */
  preview: string;
  heading: string;
  body: string;
  /** The button's label, for an email with a link. */
  button?: string;
  /** What to do if this was unexpected. */
  footnote: string;
}

const SHARED: Record<Lang, { about: string; copyLink: string; brand: string }> = {
  da: {
    about: "Casy hjælper en gruppe med at finde en dato, der passer alle.",
    copyLink: "Virker knappen ikke, så kopier denne adresse ind i din browser:",
    brand: "Casy",
  },
  en: {
    about: "Casy helps a group of people find a date that works for everyone.",
    copyLink: "If the button does not work, copy this address into your browser:",
    brand: "Casy",
  },
};

/** "Google", "Apple"; Auth names providers in lower case. */
function providerName(provider: string | undefined, lang: Lang): string {
  const names: Record<string, string> = {
    google: "Google",
    apple: "Apple",
    azure: "Microsoft",
    email: lang === "da" ? "e-mail og adgangskode" : "email and password",
  };
  return provider ? (names[provider] ?? provider) : "";
}

function wordsFor(type: string, data: EmailData, user: HookUser, lang: Lang): Words {
  const da = lang === "da";
  const email = user.email ?? "";
  switch (type) {
    case "signup":
      return da
        ? {
            subject: "Bekræft din e-mail til Casy",
            preview: "Bekræft din e-mail for at gøre din Casy-konto færdig.",
            heading: "Bekræft din e-mail",
            body: "Nogen, forhåbentlig dig, har oprettet en Casy-konto med denne e-mailadresse. Brug knappen nedenfor til at bekræfte den og logge ind. Linket virker én gang og udløber om en time.",
            button: "Bekræft e-mail",
            footnote:
              "Har du ikke oprettet en Casy-konto, kan du se bort fra denne e-mail. Uden linket kan ingen bruge en konto med din adresse.",
          }
        : {
            subject: "Confirm your email for Casy",
            preview: "Confirm your email to finish creating your Casy account.",
            heading: "Confirm your email",
            body: "Someone, hopefully you, created a Casy account with this email address. Use the button below to confirm it and sign in. The link works once and expires in one hour.",
            button: "Confirm email",
            footnote:
              "If you did not create a Casy account, you can ignore this email. Without this link, nobody can use an account with your address.",
          };
    case "magiclink":
      return da
        ? {
            subject: "Dit login-link til Casy",
            preview: "Dit login-link til Casy. Det virker én gang og udløber om en time.",
            heading: "Log ind på Casy",
            body: "Brug knappen nedenfor til at logge ind. Linket virker én gang og udløber om en time.",
            button: "Log ind",
            footnote:
              "Har du ikke bedt om at logge ind, kan du se bort fra denne e-mail. Ingen kan komme ind på din konto uden linket.",
          }
        : {
            subject: "Your Casy sign-in link",
            preview: "Your sign-in link for Casy. It works once and expires in one hour.",
            heading: "Sign in to Casy",
            body: "Use the button below to sign in. The link works once and expires in one hour.",
            button: "Sign in",
            footnote:
              "If you did not ask to sign in, you can ignore this email. Nobody can get into your account without this link.",
          };
    case "recovery":
      return da
        ? {
            subject: "Nulstil din adgangskode til Casy",
            preview:
              "Nulstil din adgangskode til Casy. Linket virker én gang og udløber om en time.",
            heading: "Nulstil din adgangskode",
            body: "Brug knappen nedenfor til at vælge en ny adgangskode. Linket virker én gang og udløber om en time.",
            button: "Nulstil adgangskode",
            footnote:
              "Har du ikke bedt om at nulstille din adgangskode, kan du se bort fra denne e-mail. Din adgangskode bliver kun ændret, hvis du åbner linket og vælger en ny.",
          }
        : {
            subject: "Reset your Casy password",
            preview: "Reset your Casy password. This link works once and expires in one hour.",
            heading: "Reset your password",
            body: "Use the button below to choose a new password. The link works once and expires in one hour.",
            button: "Reset password",
            footnote:
              "If you did not ask to reset your password, you can ignore this email. Your password will not change unless you open this link and choose a new one.",
          };
    case "reauthentication":
      return da
        ? {
            subject: "Din sikkerhedskode til Casy",
            preview: "Din kode til at skifte adgangskode på Casy.",
            heading: "Din sikkerhedskode",
            body: "Skriv denne kode på Casy for at skifte din adgangskode. Den virker én gang og udløber om en time.",
            footnote:
              "Har du ikke prøvet at skifte din adgangskode, bruger en anden måske din konto. Log ud på alle enheder fra din profil, og skift så din adgangskode.",
          }
        : {
            subject: "Your Casy security code",
            preview: "Your code for changing your Casy password.",
            heading: "Your security code",
            body: "Enter this code on Casy to change your password. It works once and expires in one hour.",
            footnote:
              "If you did not try to change your password, someone may be using your account: sign out on all devices from your profile, then change your password.",
          };
    case "email_change":
      return da
        ? {
            subject: "Bekræft din nye e-mail til Casy",
            preview: "Bekræft, at din Casy-konto skal bruge en ny e-mailadresse.",
            heading: "Bekræft din nye e-mail",
            body: "Nogen har bedt om at skifte e-mailadressen på en Casy-konto. Brug knappen nedenfor til at bekræfte det. Linket virker én gang og udløber om en time.",
            button: "Bekræft e-mail",
            footnote:
              "Har du ikke bedt om det, kan du se bort fra denne e-mail. Adressen bliver kun skiftet, hvis linket bliver åbnet.",
          }
        : {
            subject: "Confirm your new email for Casy",
            preview: "Confirm that your Casy account should use a new email address.",
            heading: "Confirm your new email",
            body: "Someone asked to change the email address of a Casy account. Use the button below to confirm it. The link works once and expires in one hour.",
            button: "Confirm email",
            footnote:
              "If you did not ask for this, you can ignore this email. The address only changes if this link is opened.",
          };
    case "password_changed_notification":
      return da
        ? {
            subject: "Din adgangskode til Casy er ændret",
            preview: "Adgangskoden til din Casy-konto er lige blevet ændret.",
            heading: "Din adgangskode er ændret",
            body: `Adgangskoden til din Casy-konto (${email}) er lige blevet ændret, og alle andre enheder, der var logget ind, er blevet logget ud.`,
            footnote:
              'Var det ikke dig, så nulstil din adgangskode med det samme med "Glemt adgangskode?" på log ind-siden på casy.app, og log ud på alle enheder fra din profil.',
          }
        : {
            subject: "Your Casy password was changed",
            preview: "The password for your Casy account was just changed.",
            heading: "Your password was changed",
            body: `The password for your Casy account (${email}) was just changed, and any other devices signed in to it were signed out.`,
            footnote:
              'If this was not you, reset your password straight away with "Forgot password?" on the sign-in page at casy.app, and sign out on all devices from your profile.',
          };
    case "email_changed_notification":
      return da
        ? {
            subject: "Din e-mail til Casy er ændret",
            preview: "Din Casy-konto bruger nu en ny e-mailadresse.",
            heading: "Din e-mail er ændret",
            body: `Din Casy-konto bruger nu ${email}${data.old_email ? ` i stedet for ${data.old_email}` : ""}.`,
            footnote:
              "Var det ikke dig, så nulstil din adgangskode på casy.app, og log ud på alle enheder fra din profil.",
          }
        : {
            subject: "Your Casy email was changed",
            preview: "Your Casy account now uses a new email address.",
            heading: "Your email was changed",
            body: `Your Casy account now uses ${email}${data.old_email ? ` instead of ${data.old_email}` : ""}.`,
            footnote:
              "If this was not you, reset your password at casy.app and sign out on all devices from your profile.",
          };
    case "identity_linked_notification":
    case "identity_unlinked_notification": {
      const linked = type === "identity_linked_notification";
      const name = providerName(data.provider, lang);
      return da
        ? {
            subject: linked
              ? "En ny måde at logge ind på Casy"
              : "En måde at logge ind på Casy er fjernet",
            preview: linked
              ? "Din Casy-konto har fået en ny måde at logge ind på."
              : "En måde at logge ind på din Casy-konto er fjernet.",
            heading: linked ? "Ny måde at logge ind på" : "En måde at logge ind på er fjernet",
            body: linked
              ? `Du kan nu logge ind på din Casy-konto (${email}) med ${name}.`
              : `Du kan ikke længere logge ind på din Casy-konto (${email}) med ${name}.`,
            footnote:
              "Var det ikke dig, så nulstil din adgangskode på casy.app, og log ud på alle enheder fra din profil.",
          }
        : {
            subject: linked
              ? "A new way to sign in to Casy"
              : "A way to sign in to Casy was removed",
            preview: linked
              ? "Your Casy account has a new way to sign in."
              : "A way to sign in to your Casy account was removed.",
            heading: linked ? "A new way to sign in" : "A way to sign in was removed",
            body: linked
              ? `You can now sign in to your Casy account (${email}) with ${name}.`
              : `You can no longer sign in to your Casy account (${email}) with ${name}.`,
            footnote:
              "If this was not you, reset your password at casy.app and sign out on all devices from your profile.",
          };
    }
    case "mfa_factor_enrolled_notification":
    case "mfa_factor_unenrolled_notification": {
      const added = type === "mfa_factor_enrolled_notification";
      return da
        ? {
            subject: added
              ? "Totrinslogin er slået til på Casy"
              : "Totrinslogin er slået fra på Casy",
            preview: added
              ? "Din Casy-konto beder nu om en kode, når du logger ind."
              : "Din Casy-konto beder ikke længere om en kode, når du logger ind.",
            heading: added ? "Totrinslogin er slået til" : "Totrinslogin er slået fra",
            body: added
              ? `Din Casy-konto (${email}) beder nu om en kode fra en godkendelsesapp, når du logger ind.`
              : `Din Casy-konto (${email}) beder ikke længere om en kode fra en godkendelsesapp, når du logger ind.`,
            footnote:
              "Var det ikke dig, så nulstil din adgangskode på casy.app, og log ud på alle enheder fra din profil.",
          }
        : {
            subject: added ? "Two-step sign-in is on for Casy" : "Two-step sign-in is off for Casy",
            preview: added
              ? "Your Casy account now asks for a code when you sign in."
              : "Your Casy account no longer asks for a code when you sign in.",
            heading: added ? "Two-step sign-in is on" : "Two-step sign-in is off",
            body: added
              ? `Your Casy account (${email}) now asks for a code from an authenticator app when you sign in.`
              : `Your Casy account (${email}) no longer asks for a code from an authenticator app when you sign in.`,
            footnote:
              "If this was not you, reset your password at casy.app and sign out on all devices from your profile.",
          };
    }
    default:
      // Anything Auth adds later, or invites, which Casy doesn't use: a
      // plain email with whatever link or code came with it, never nothing.
      return da
        ? {
            subject: "En besked fra Casy",
            preview: "En besked om din Casy-konto.",
            heading: "En besked om din Casy-konto",
            body: "Casy har fået besked om at sende dig dette om din konto.",
            button: "Åbn Casy",
            footnote: "Har du ikke bedt om noget fra Casy, kan du se bort fra denne e-mail.",
          }
        : {
            subject: "A message from Casy",
            preview: "A message about your Casy account.",
            heading: "A message about your Casy account",
            body: "Casy was asked to send you this about your account.",
            button: "Open Casy",
            footnote: "If you did not ask Casy for anything, you can ignore this email.",
          };
  }
}

// ---------------------------------------------------------------------------
// The layout
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** The site's palette, as hex (email clients don't read CSS variables). */
const C = {
  page: "#faf8f5",
  card: "#ffffff",
  border: "#e2e4e9",
  ink: "#1f2533",
  muted: "#677183",
  accent: "#e9560c",
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function html(lang: Lang, w: Words, link: string | null, code: string | null): string {
  const s = SHARED[lang];
  const e = escapeHtml;
  const row = (inner: string, padding = "24px 32px 0 32px") =>
    `<tr><td style="padding: ${padding};">${inner}</td></tr>`;

  const rows = [
    row(
      `<p style="margin: 0; font-size: 15px; font-weight: 700; color: ${C.accent}; letter-spacing: 0.02em;">${s.brand}</p>`,
      "32px 32px 0 32px",
    ),
    row(
      `<h1 style="margin: 0; font-size: 22px; line-height: 1.3; font-weight: 700; color: ${C.ink};">${e(w.heading)}</h1>` +
        `<p style="margin: 12px 0 0 0; font-size: 15px; line-height: 1.6; color: ${C.ink};">${e(w.body)}</p>`,
      "20px 32px 0 32px",
    ),
  ];
  if (link && w.button) {
    rows.push(
      row(
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
          `<td style="background-color: ${C.accent}; border-radius: 999px;">` +
          `<a href="${e(link)}" style="display: inline-block; padding: 13px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">${e(w.button)}</a>` +
          `</td></tr></table>`,
      ),
      row(
        `<p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${C.muted};">${e(s.copyLink)}</p>` +
          `<p style="margin: 6px 0 0 0; font-size: 13px; line-height: 1.5; word-break: break-all;">` +
          `<a href="${e(link)}" style="color: ${C.accent}; text-decoration: underline;">${e(link)}</a></p>`,
      ),
    );
  }
  if (code) {
    rows.push(
      row(
        `<p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 0.2em; color: ${C.ink}; font-family: ui-monospace, Menlo, Consolas, monospace;">${e(code)}</p>`,
      ),
    );
  }
  rows.push(
    row(
      `<div style="height: 1px; background-color: ${C.border}; line-height: 1px; font-size: 0;">&nbsp;</div>`,
    ),
    row(
      `<p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${C.muted};">${e(w.footnote)}</p>`,
      "20px 32px 32px 32px",
    ),
  );

  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(w.subject)}</title></head>
<body style="margin: 0; padding: 0; background-color: ${C.page}; font-family: ${FONT};">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${e(w.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${C.page};"><tr><td align="center" style="padding: 32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px;">
${rows.join("\n")}
</table>
<p style="max-width: 480px; margin: 20px auto 0 auto; font-size: 12px; line-height: 1.6; color: ${C.muted}; text-align: center;">${e(s.about)}</p>
</td></tr></table>
</body>
</html>`;
}

/** The same email as plain text, for clients that don't show HTML (and spam filters that like both). */
function text(lang: Lang, w: Words, link: string | null, code: string | null): string {
  const parts = [w.heading, "", w.body];
  if (link) parts.push("", link);
  if (code) parts.push("", code);
  parts.push("", w.footnote, "", SHARED[lang].about);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------

/**
 * Every email one hook call asks for: usually one. A secure email change is
 * two, one to each address, each with its own link (Auth's naming is the
 * wrong way round for history's sake: `token_hash_new` goes to the current
 * address, `token_hash` to the new one).
 */
export function renderAuthEmails(
  user: HookUser,
  data: EmailData,
  supabaseUrl: string,
): AuthEmail[] {
  const lang = emailLang(user, data);
  const type = data.email_action_type;
  const redirectTo = data.redirect_to || data.site_url || "https://casy.app";
  const words = wordsFor(type, data, user, lang);
  const build = (to: string | undefined, link: string | null, code: string | null) =>
    to
      ? [
          {
            to,
            subject: words.subject,
            html: html(lang, words, link, code),
            text: text(lang, words, link, code),
          },
        ]
      : [];
  const linkFor = (hash: string | undefined) =>
    hash ? verifyUrl(supabaseUrl, hash, type, redirectTo) : null;

  switch (type) {
    case "signup":
    case "magiclink":
    case "recovery":
      return build(user.email, linkFor(data.token_hash), null);
    case "reauthentication":
      return build(user.email, null, data.token ?? null);
    case "email_change":
      return [
        ...(data.token_hash_new ? build(user.email, linkFor(data.token_hash_new), null) : []),
        ...(data.token_hash
          ? build(user.new_email ?? user.email, linkFor(data.token_hash), null)
          : []),
      ];
    case "password_changed_notification":
    case "email_changed_notification":
    case "identity_linked_notification":
    case "identity_unlinked_notification":
    case "mfa_factor_enrolled_notification":
    case "mfa_factor_unenrolled_notification":
      return build(user.email, null, null);
    default:
      // Whatever came with it: a link (to the verify endpoint, or else the
      // site), and a code if there is one.
      return build(user.email, linkFor(data.token_hash) ?? redirectTo, data.token ?? null);
  }
}
