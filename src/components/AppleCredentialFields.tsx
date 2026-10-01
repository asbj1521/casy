import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

import InfoTip from "@/components/InfoTip";
import Notice from "@/components/ui/Notice";
import { useT } from "@/i18n/lang";
import { APP_PASSWORD_EXAMPLE, looksLikeAppSpecificPassword } from "@/lib/appleCredentials";

/**
 * The two things connecting iCloud takes: the Apple Account email and an
 * app-specific password. Shared by the Apple card's quick form and the
 * step-by-step setup, so both check the password the same way.
 *
 * The check (appleCredentials.ts) waits until the password is pasted or the
 * form is sent, so nobody is told off halfway through typing one by hand.
 * From then on it follows every change, so fixing the password clears the
 * warning straight away. Deliberately not on leaving the field: pressing
 * Connect is what leaves it, and a warning appearing right then pushes the
 * button down between press and release, so the click misses it.
 *
 * Text is 16px on phones: iPhone Safari zooms the page into any smaller input
 * it focuses, which is disorienting in the middle of a form.
 */
export default function AppleCredentialFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  emailHint,
  passwordHint,
  withAboutTip = false,
}: {
  email: string;
  password: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  /** A line under the email field. */
  emailHint?: ReactNode;
  /** A line under the password field. */
  passwordHint?: ReactNode;
  /** The (i) explaining app-specific passwords, for places with no other explanation nearby. */
  withAboutTip?: boolean;
}) {
  const t = useT();
  const emailId = useId();
  const passwordId = useId();
  const emailHintId = useId();
  const passwordHintId = useId();
  const warningId = useId();
  const [checkShape, setCheckShape] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Whichever form these fields sit in, sending it turns the check on. Heard
  // from the form itself, so neither place using the fields has to pass it in.
  useEffect(() => {
    const form = passwordRef.current?.form;
    if (!form) return;
    const check = () => setCheckShape(true);
    form.addEventListener("submit", check);
    return () => form.removeEventListener("submit", check);
  }, []);
  const shapeLooksWrong =
    checkShape && password.trim() !== "" && !looksLikeAppSpecificPassword(password);

  const inputClass =
    "w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm";

  return (
    <>
      <div className="text-sm">
        <label htmlFor={emailId} className="mb-1 block font-medium text-foreground">
          {t.appleForm.email}
        </label>
        <input
          id={emailId}
          type="email"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@icloud.com"
          aria-describedby={emailHint ? emailHintId : undefined}
          className={inputClass}
        />
        {emailHint && (
          <p id={emailHintId} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {emailHint}
          </p>
        )}
      </div>
      <div className="text-sm">
        {/* The (i) sits beside the label, not inside it: a button inside a
            <label> would take over the label from its input. */}
        <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5" />
          <label htmlFor={passwordId}>{t.appleForm.password}</label>
          {withAboutTip && <InfoTip label={t.appleForm.about}>{t.appleForm.aboutBody}</InfoTip>}
        </div>
        <input
          ref={passwordRef}
          id={passwordId}
          type="password"
          required
          autoComplete="off"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onPaste={() => setCheckShape(true)}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          aria-describedby={
            [passwordHint ? passwordHintId : null, shapeLooksWrong ? warningId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={inputClass}
        />
        {passwordHint && (
          <p id={passwordHintId} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {passwordHint}
          </p>
        )}
        {/* Announced when it appears, without moving focus off the field. */}
        <div aria-live="polite">
          {shapeLooksWrong && (
            <Notice tone="warning" id={warningId} className="mt-2">
              {t.appleForm.looksWrong(
                <span className="whitespace-nowrap font-mono">{APP_PASSWORD_EXAMPLE}</span>,
              )}
            </Notice>
          )}
        </div>
      </div>
    </>
  );
}
