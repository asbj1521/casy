import { useLayoutEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2, Mail } from "lucide-react";

import { calendarStatusQuery } from "@/api/calendars";
import PasswordForm from "@/components/PasswordForm";
import TopNav from "@/components/TopNav";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH } from "@/hooks/useCalendarsHome";
import { useCaptcha } from "@/hooks/useCaptcha";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { authErrorMessage } from "@/i18n/authError";
import { useLang, useT } from "@/i18n/lang";
import { cardArrived } from "@/lib/cardTransition";
import { hasSeenCalendarOnboarding } from "@/lib/calendarOnboarding";
import { checkPassword, passesChecks, personalWords, timesLeaked } from "@/lib/passwordRules";
import { supabaseAuth } from "@/lib/supabase";
import { clearWeakPassword, flagWeakPassword } from "@/lib/weakPassword";

/**
 * Where to go after signing in, if the link said. Only a path on this site is
 * accepted: taking any URL from the query string would let a crafted link
 * bounce someone to a look-alike site straight after they log in.
 * "//evil.com" is a full URL to a browser, so it is refused along with
 * "https://...". Null when there is none; see the redirect below.
 */
function safeNext(raw: string | null): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

/**
 * A failed Google sign-in comes back to this page with the reason in the URL,
 * in the query or after the #, depending on where it failed.
 */
function errorFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return hash.get("error_description") ?? query.get("error_description");
}

/**
 * Sign in with Google, a one-time email link, or an email + password —
 * either an existing one or a fresh account created with one.
 *
 * All of these send the browser back to this page rather than straight to
 * where the person was headed. By the time they return, the Supabase client
 * has read the login out of the URL, and the redirect below forwards them
 * on; if it failed, the reason is shown here instead of being lost on a page
 * that would just bounce them back again.
 *
 * A password-reset link also lands here. It signs the browser in the same
 * way, but `passwordRecovery` (from a Supabase `PASSWORD_RECOVERY` event)
 * says to show a "choose a new password" form instead of forwarding them on
 * — checked before the ordinary `user` redirect below, since a recovery
 * session already has a signed-in user.
 */
export default function SignIn() {
  const { user, loading, passwordRecovery, clearPasswordRecovery } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const phone = usePhoneLayout();
  // Arriving from the landing page's "Sign in", its chart card flies into
  // the box below (cardTransition.ts), which waits for this page to be drawn.
  useLayoutEffect(cardArrived, []);

  const [mode, setMode] = useState<"link" | "password">("password");
  // A "Sign up" link elsewhere (e.g. the example-group nudge) can land here
  // with ?signup=1 to open straight on the create-account tab.
  const [passwordTab, setPasswordTab] = useState<"signin" | "signup">(
    searchParams.get("signup") ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(errorFromUrl);

  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSentTo, setForgotSentTo] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  // A new account waits for its email to be confirmed: where the link went,
  // and whether it was sent again. Also set when signing in before confirming.
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Bot protection for every email and password call below (useCaptcha).
  // Taken apart so the widget's ref callback stays separate from the token.
  const {
    enabled: captchaEnabled,
    token: captchaValue,
    failed: captchaFailed,
    attach: attachCaptcha,
    reset: resetCaptcha,
  } = useCaptcha(lang);

  // Whether to route a freshly-signed-in person on a phone through "connect
  // your calendar" first (see the redirect below) rather than send them
  // straight on; on a computer, it is the answer the pop-up waits for. Already warmed from localStorage for anyone who has visited before
  // (see queryPersistence.ts), so this only waits on a network round trip
  // the very first time a browser ever asks it.
  const calendarStatus = useQuery({ ...calendarStatusQuery(user?.id ?? ""), enabled: !!user });

  if (loading) return <div className="min-h-screen bg-background" />;

  // Come back to this page, still carrying where to go afterwards.
  const returnTo = `${window.location.origin}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  /** Why a call can't go yet (no bot-check token), or null when it can. */
  function captchaProblem(): string | null {
    if (!captchaEnabled || captchaValue) return null;
    return captchaFailed ? t.signIn.captchaFailed : t.signIn.captchaWait;
  }
  // Sent with every call; undefined while bot protection isn't set up.
  const captchaToken = captchaValue ?? undefined;

  async function handleNewPassword(newPassword: string) {
    setRecoverySubmitting(true);
    setRecoveryError(null);
    const { error: err } = await supabaseAuth.updateUser({ password: newPassword });
    if (err) {
      setRecoverySubmitting(false);
      setRecoveryError(authErrorMessage(err, t));
      return;
    }
    // A reset is often because someone else got in: sign out every other device.
    await supabaseAuth.signOut({ scope: "others" });
    setRecoverySubmitting(false);
    clearWeakPassword();
    clearPasswordRecovery();
  }

  if (passwordRecovery) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-sm px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t.signIn.newPasswordTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.signIn.newPasswordIntro}</p>
          <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:mt-8 sm:p-6">
            <PasswordForm
              submitting={recoverySubmitting}
              error={recoveryError}
              submitLabel={t.profile.savePassword}
              submittingLabel={t.profile.saving}
              personal={[user?.email]}
              onSubmit={(pw) => void handleNewPassword(pw)}
            />
          </div>
        </main>
      </div>
    );
  }

  if (user) {
    // A computer goes where it was heading, and asks for a calendar there if
    // none is connected (ConnectCalendarPrompt).
    if (!phone) return <Navigate to={next ?? "/"} replace />;
    // Give calendarStatus a moment to answer before deciding where to send a
    // freshly-signed-in person, so nobody is bounced to `next` and then
    // immediately on again to the connect-a-calendar step.
    if (calendarStatus.isLoading) return <div className="min-h-screen bg-background" />;
    const hasCalendar = (calendarStatus.data?.length ?? 0) > 0;
    if (!hasCalendar && !hasSeenCalendarOnboarding(user.id)) {
      return <Navigate to={`${CALENDAR_ACCOUNTS_PATH}?onboarding=1`} replace />;
    }
    // No destination in the link (the header's or landing page's "Log ind"):
    // the scheduler for anyone with a calendar, the page to connect one
    // otherwise (on a phone; a computer was sent on above).
    return <Navigate to={next ?? (hasCalendar ? "/" : CALENDAR_ACCOUNTS_PATH)} replace />;
  }

  async function handleGoogle() {
    setError(null);
    const { error: err } = await supabaseAuth.signInWithOAuth({
      provider: "google",
      // hl: Google's own sign-in screen in the page's language.
      options: { redirectTo: returnTo, queryParams: { hl: lang } },
    });
    // On success the browser is already leaving for Google.
    if (err) setError(authErrorMessage(err, t));
  }

  async function handleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = captchaProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setSending(true);
    setError(null);
    const address = email.trim();
    const { error: err } = await supabaseAuth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: returnTo, captchaToken },
    });
    resetCaptcha();
    setSending(false);
    if (err) setError(authErrorMessage(err, t));
    else setSentTo(address);
  }

  async function handlePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const problem = captchaProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setSending(true);
    setError(null);
    setUnconfirmed(null);
    const address = email.trim();
    const typed = password;
    const { data, error: err } = await supabaseAuth.signInWithPassword({
      email: address,
      password: typed,
      options: { captchaToken },
    });
    resetCaptcha();
    setSending(false);
    // On success the auth state change above redirects via `user`.
    if (err) {
      setError(authErrorMessage(err, t));
      // Signed up but never clicked the link: offer to send it again.
      if (err.code === "email_not_confirmed") {
        setUnconfirmed(address);
        setResend("idle");
        setResendError(null);
      }
      return;
    }
    // A password chosen before today's rules gets a note asking for a new
    // one (WeakPasswordNotice). Supabase flags the ones its own rules catch;
    // the rest (a name in it, a known leak) are checked here, after the
    // redirect, so signing in never waits on them.
    const userId = data.user?.id;
    if (!userId) return;
    if (data.weakPassword?.reasons?.length) {
      flagWeakPassword(userId);
      return;
    }
    void (async () => {
      if (
        !passesChecks(checkPassword(typed, personalWords([address]))) ||
        (await timesLeaked(typed))
      ) {
        flagWeakPassword(userId);
      }
    })();
  }

  async function handleSignUp(newPassword: string) {
    const problem = captchaProblem();
    if (problem) {
      setSignupError(problem);
      return;
    }
    setSignupSubmitting(true);
    setSignupError(null);
    const address = email.trim();
    const { data, error: err } = await supabaseAuth.signUp({
      email: address,
      password: newPassword,
      options: { emailRedirectTo: returnTo, captchaToken },
    });
    resetCaptcha();
    setSignupSubmitting(false);
    if (err) {
      setSignupError(authErrorMessage(err, t));
      return;
    }
    // An address that already has an account: with confirmations on,
    // Supabase answers with a stand-in user with no identities rather than an
    // error (so the answer alone doesn't reveal who has an account). The
    // message is the same as before: sign in the way they already do and add
    // a password from the profile, rather than a second, disconnected account.
    if (data.user && data.user.identities?.length === 0) {
      setSignupError(t.authErrors.userExists);
      return;
    }
    // Email confirmation is on: the account works once the link in the
    // email is clicked, which signs them in and brings them back here.
    if (!data.session) {
      setConfirmSentTo(address);
      setResend("idle");
      setResendError(null);
    }
    // With a session (confirmation switched off), the redirect via `user` runs.
  }

  async function handleResendConfirm(address: string) {
    const problem = captchaProblem();
    if (problem) {
      setResendError(problem);
      return;
    }
    setResend("sending");
    setResendError(null);
    const { error: err } = await supabaseAuth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: returnTo, captchaToken },
    });
    resetCaptcha();
    if (err) {
      setResend("idle");
      setResendError(authErrorMessage(err, t));
    } else setResend("sent");
  }

  async function handleForgotPassword() {
    const address = email.trim();
    if (!address) {
      setForgotError(t.signIn.enterEmailFirst);
      return;
    }
    const problem = captchaProblem();
    if (problem) {
      setForgotError(problem);
      return;
    }
    setForgotSending(true);
    setForgotError(null);
    const { error: err } = await supabaseAuth.resetPasswordForEmail(address, {
      redirectTo: returnTo,
      captchaToken,
    });
    resetCaptcha();
    setForgotSending(false);
    if (err) setForgotError(authErrorMessage(err, t));
    else setForgotSentTo(address);
  }

  function switchMode(next: "link" | "password") {
    setMode(next);
    setPasswordTab("signin");
    setError(null);
    setSentTo(null);
    setForgotSentTo(null);
    setForgotError(null);
    setSignupError(null);
    setConfirmSentTo(null);
    setUnconfirmed(null);
  }

  function switchPasswordTab(next: "signin" | "signup") {
    setPasswordTab(next);
    setError(null);
    setForgotSentTo(null);
    setForgotError(null);
    setSignupError(null);
    setConfirmSentTo(null);
    setUnconfirmed(null);
  }

  /** "Send it again", or that it was, for a confirmation email. */
  const resendButton = (address: string) =>
    resend === "sent" ? (
      <span className="font-medium">{t.signIn.confirmResent}</span>
    ) : (
      <button
        type="button"
        disabled={resend === "sending"}
        onClick={() => void handleResendConfirm(address)}
        className="font-medium underline underline-offset-2 disabled:opacity-60"
      >
        {resend === "sending" ? t.signIn.confirmResending : t.signIn.confirmResend}
      </button>
    );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto max-w-sm px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t.signIn.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.signIn.intro}</p>

        {/* Arrived here right after deleting an account from the profile. */}
        {searchParams.get("deleted") && (
          <Notice tone="success" className="mt-4">
            {t.signIn.accountDeleted}
          </Notice>
        )}

        {/* vt-card: where the landing chart lands (cardTransition.ts); its
            contents fade in once it has. */}
        <div className="vt-card mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:mt-8 sm:p-6">
          <div className="vt-card-content">
            <button
              type="button"
              onClick={() => void handleGoogle()}
              className="flex w-full items-center justify-center gap-2 rounded-full border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                G
              </span>
              {t.signIn.google}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t.signIn.or}
              <span className="h-px flex-1 bg-border" />
            </div>

            {mode === "link" ? (
              sentTo ? (
                <Notice tone="success">
                  {t.signIn.linkSent(
                    <strong>{sentTo}</strong>,
                    <button
                      type="button"
                      onClick={() => setSentTo(null)}
                      className="font-medium underline underline-offset-2"
                    >
                      {t.signIn.otherEmail}
                    </button>,
                  )}
                </Notice>
              ) : (
                <form onSubmit={(e) => void handleEmail(e)} className="flex flex-col gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-foreground">{t.signIn.email}</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.signIn.emailPlaceholder}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {sending ? t.signIn.sendingLink : t.signIn.sendLink}
                  </button>
                </form>
              )
            ) : (
              <>
                {/* Sign in with an existing password, or create an account with
                  a new one. Signing up with an email that already has a
                  Google or email-link account fails (manual linking is off),
                  and the error says to sign in that way and add a password
                  from the profile page instead of ending up with a second,
                  disconnected account. */}
                <div className="mb-4 flex gap-1 rounded-full bg-secondary p-1 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => switchPasswordTab("signin")}
                    className={`flex-1 rounded-full py-1.5 transition ${
                      passwordTab === "signin"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.signIn.tabSignIn}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPasswordTab("signup")}
                    className={`flex-1 rounded-full py-1.5 transition ${
                      passwordTab === "signup"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.signIn.tabSignUp}
                  </button>
                </div>

                {passwordTab === "signin" ? (
                  forgotSentTo ? (
                    <Notice tone="success">
                      {t.signIn.resetSent(
                        <strong>{forgotSentTo}</strong>,
                        <button
                          type="button"
                          onClick={() => setForgotSentTo(null)}
                          className="font-medium underline underline-offset-2"
                        >
                          {t.signIn.tryAgain}
                        </button>,
                      )}
                    </Notice>
                  ) : (
                    <form onSubmit={(e) => void handlePassword(e)} className="flex flex-col gap-3">
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-foreground">
                          {t.signIn.email}
                        </span>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t.signIn.emailPlaceholder}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-foreground">
                          {t.signIn.password}
                        </span>
                        <input
                          type="password"
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={sending}
                        className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4" />
                        )}
                        {sending ? t.signIn.signingIn : t.signIn.signInButton}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleForgotPassword()}
                        disabled={forgotSending}
                        className="self-start text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground disabled:opacity-60"
                      >
                        {forgotSending ? t.signIn.sendingReset : t.signIn.forgot}
                      </button>
                      {forgotError && <Notice tone="error">{forgotError}</Notice>}
                    </form>
                  )
                ) : confirmSentTo ? (
                  <Notice tone="success" icon={Mail}>
                    {t.signIn.confirmSent(
                      <strong>{confirmSentTo}</strong>,
                      resendButton(confirmSentTo),
                      <button
                        type="button"
                        onClick={() => setConfirmSentTo(null)}
                        className="font-medium underline underline-offset-2"
                      >
                        {t.signIn.otherEmail}
                      </button>,
                    )}
                    {resendError && <span className="mt-1 block text-red-800">{resendError}</span>}
                  </Notice>
                ) : (
                  <div className="flex flex-col gap-3">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-foreground">
                        {t.signIn.email}
                      </span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.signIn.emailPlaceholder}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <PasswordForm
                      submitting={signupSubmitting}
                      error={signupError}
                      submitLabel={t.signIn.createAccount}
                      submittingLabel={t.signIn.creatingAccount}
                      passwordLabel={t.signIn.password}
                      personal={[email]}
                      onSubmit={(pw) => void handleSignUp(pw)}
                    />
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => switchMode(mode === "link" ? "password" : "link")}
              className="mt-4 text-xs text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
            >
              {mode === "link" ? t.signIn.usePassword : t.signIn.useLink}
            </button>

            {/* Cloudflare's bot check: invisible unless it wants a click. */}
            <div ref={attachCaptcha} className="mt-3 empty:hidden" />

            {error && (
              <Notice tone="error" className="mt-4">
                {error}
                {unconfirmed && <> {resendButton(unconfirmed)}</>}
                {unconfirmed && resendError && <span className="mt-1 block">{resendError}</span>}
              </Notice>
            )}
          </div>
        </div>

        {/* Signing in (or creating an account) is accepting the terms. The
            invite page sends people here too, so this one line covers both. */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t.signIn.acceptTerms(
            <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
              {t.signIn.termsLink}
            </Link>,
            <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
              {t.signIn.privacyLink}
            </Link>,
          )}
        </p>
      </main>
    </div>
  );
}
