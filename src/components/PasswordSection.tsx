import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LogOut } from "lucide-react";

import PasswordCodeStep from "@/components/PasswordCodeStep";
import PasswordForm from "@/components/PasswordForm";
import Notice from "@/components/ui/Notice";
import { useAuth, useSignedInUser } from "@/context/auth";
import { authErrorMessage } from "@/i18n/authError";
import { useT } from "@/i18n/lang";
import { supabase } from "@/lib/supabase";
import { clearWeakPassword } from "@/lib/weakPassword";

/**
 * The profile page's password: set one, or change it. It works alongside
 * Google and the email link, never replacing them, and one form covers both
 * a first password and a new one, since the browser can't reliably tell
 * which this is. Also "Sign out on all devices".
 *
 * `?password=new` (the weak-password note's link) opens the form and brings
 * it into view.
 */
export default function PasswordSection({
  name,
}: {
  /** The name the password mustn't be built from, beside the email. */
  name: string;
}) {
  const t = useT();
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionRef = useRef<HTMLElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // A new password waiting for the emailed code (see PasswordCodeStep).
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [codeResent, setCodeResent] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  function open() {
    setSaved(false);
    setError(null);
    setFormOpen(true);
  }

  function close() {
    setCodeFor(null);
    setFormOpen(false);
    setError(null);
  }

  // Opened while rendering, as the parameter arrives (React's pattern for
  // adjusting state when an input changes), so there is no extra render.
  const passwordParam = searchParams.get("password");
  const [seenParam, setSeenParam] = useState<string | null>(null);
  if (passwordParam !== seenParam) {
    setSeenParam(passwordParam);
    if (passwordParam === "new") open();
  }
  useEffect(() => {
    if (passwordParam !== "new") return;
    setSearchParams(
      (params) => {
        params.delete("password");
        return params;
      },
      { replace: true },
    );
    requestAnimationFrame(() =>
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [passwordParam, setSearchParams]);

  /**
   * Save a new password. Signed in more than a day ago, Supabase first wants
   * a code it emails (secure_password_change): the password waits in
   * `codeFor` until it is typed in, then goes with it as the nonce.
   */
  async function save(password: string, nonce?: string) {
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser(
      nonce ? { password, nonce } : { password },
    );
    if (err?.code === "reauthentication_needed") {
      const { error: sendErr } = await supabase.auth.reauthenticate();
      setSubmitting(false);
      if (sendErr) setError(authErrorMessage(sendErr, t));
      else {
        setCodeResent(false);
        setCodeFor(password);
      }
      return;
    }
    if (err) {
      setSubmitting(false);
      setError(authErrorMessage(err, t));
      return;
    }
    // Whoever else might be signed in as you (the reason to change a
    // password, often) is signed out; this device stays signed in.
    await supabase.auth.signOut({ scope: "others" });
    setSubmitting(false);
    close();
    setSaved(true);
    clearWeakPassword();
  }

  async function resendCode() {
    setError(null);
    const { error: err } = await supabase.auth.reauthenticate();
    if (err) setError(authErrorMessage(err, t));
    else setCodeResent(true);
  }

  function signOutEverywhere() {
    setSigningOut(true);
    setSignOutFailed(false);
    signOut("global")
      .then(() => navigate("/"))
      .catch(() => {
        setSigningOut(false);
        setSignOutFailed(true);
      });
  }

  return (
    <section ref={sectionRef} className="mt-8 scroll-mt-4">
      <h2 className="text-lg font-semibold text-foreground">{t.profile.password}</h2>
      <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        {saved && !formOpen && (
          <Notice tone="success" bare className="mb-3">
            {t.profile.passwordSaved}
          </Notice>
        )}
        {formOpen && codeFor ? (
          <PasswordCodeStep
            email={user.email ?? ""}
            submitting={submitting}
            error={error}
            resent={codeResent}
            onSubmit={(code) => void save(codeFor, code)}
            onResend={() => void resendCode()}
            onCancel={close}
          />
        ) : formOpen ? (
          <PasswordForm
            submitting={submitting}
            error={error}
            submitLabel={t.profile.savePassword}
            submittingLabel={t.profile.saving}
            personal={[user.email, name]}
            onSubmit={(password) => void save(password)}
            onCancel={close}
          />
        ) : (
          <button
            type="button"
            onClick={open}
            className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            {t.profile.setPassword}
          </button>
        )}

        {/* Every session this account has, this one included. */}
        <div className="mt-5 border-t pt-4">
          <button
            type="button"
            disabled={signingOut}
            onClick={signOutEverywhere}
            className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {signingOut ? t.profile.signingOutEverywhere : t.profile.signOutEverywhere}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">{t.profile.signOutEverywhereHelp}</p>
          {signOutFailed && (
            <Notice tone="error" bare className="mt-2">
              {t.profile.couldntSignOutEverywhere}
            </Notice>
          )}
        </div>
      </div>
    </section>
  );
}
