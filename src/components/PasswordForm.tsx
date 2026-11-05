import { useId, useMemo, useState, type FormEvent } from "react";
import { Check, Circle, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useLang, useT, LOCALE } from "@/i18n/lang";
import {
  checkPassword,
  MIN_PASSWORD_LENGTH,
  passesChecks,
  personalWords,
  timesLeaked,
} from "@/lib/passwordRules";
import { cn } from "@/lib/utils";

/**
 * A new-password + confirm-password pair, used both for setting/changing a
 * password on the profile page and for the "choose a new password" step of
 * the forgot-password flow on the sign-in page.
 *
 * It owns its fields and checks the two match before calling `onSubmit` with
 * a single password: nothing outside cares what was typed into either box,
 * only the value once it has been confirmed. The submitting/error state
 * comes from the caller, since it belongs to the request rather than the
 * form; the match check is purely local, so it is cleared on every keystroke
 * rather than surviving until the next submit.
 *
 * The rules (src/lib/passwordRules.ts) are listed under the field and tick
 * off as they are met. On submit, after they pass, the password is checked
 * against known data leaks; a leaked one is refused with the reason. If that
 * check can't be reached, the password goes through on the rules alone.
 *
 * `single` (a new account, #212): one field and a button to see what was
 * typed, instead of typing it twice. Changing a password keeps the pair.
 */
export default function PasswordForm({
  submitting,
  error,
  submitLabel,
  submittingLabel,
  passwordLabel,
  personal = [],
  single = false,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  submittingLabel: string;
  /** "New password" fits changing one; a fresh sign-up reads better as "Password". */
  passwordLabel?: string;
  /** The person's email and name, which the password mustn't be built from. */
  personal?: (string | null | undefined)[];
  /** One field with a show-password button, no confirm field. */
  single?: boolean;
  onSubmit: (password: string) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  // The design language's fields on a phone and in the app (#161).
  const phone = usePhoneLayout();
  const inputClass = phone
    ? FIELD
    : "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const { lang } = useLang();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [shown, setShown] = useState(false);
  // A problem found here, before anything is sent: shown until the next keystroke.
  const [localError, setLocalError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const passwordId = useId();
  const confirmId = useId();
  // Joined so the list only changes when the values do, not every render.
  const personalKey = personal.filter(Boolean).join("\n");
  const words = useMemo(() => personalWords(personalKey.split("\n")), [personalKey]);
  const checks = checkPassword(password, words);
  const rules = [
    { met: checks.length, label: t.passwordForm.ruleLength(MIN_PASSWORD_LENGTH) },
    { met: checks.lettersAndDigits, label: t.passwordForm.ruleLettersDigits },
    { met: checks.notPersonal, label: t.passwordForm.ruleNotPersonal },
  ];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!single && password !== confirm) {
      setLocalError(t.passwordForm.mismatch);
      return;
    }
    if (!passesChecks(checks)) {
      setLocalError(t.passwordForm.rulesNotMet);
      return;
    }
    setChecking(true);
    const leaked = await timesLeaked(password);
    setChecking(false);
    if (leaked) {
      setLocalError(t.passwordForm.leaked(leaked.toLocaleString(LOCALE[lang])));
      return;
    }
    onSubmit(password);
  }

  const busy = submitting || checking;
  const clearLocalError = () => setLocalError(null);

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="flex flex-col gap-3">
        <div className="text-sm">
          <div
            className={
              phone
                ? `${FIELD_LABEL} flex items-center gap-1.5`
                : "mb-1 flex items-center gap-1.5 font-medium text-foreground"
            }
          >
            <Lock className="h-3.5 w-3.5" />
            <label htmlFor={passwordId}>{passwordLabel ?? t.passwordForm.newPassword}</label>
          </div>
          <div className="relative">
            <input
              id={passwordId}
              type={single && shown ? "text" : "password"}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearLocalError();
              }}
              className={cn(inputClass, single && "pr-12")}
            />
            {single && (
              <button
                type="button"
                onClick={() => setShown(!shown)}
                aria-label={shown ? t.passwordForm.hide : t.passwordForm.show}
                aria-pressed={shown}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
              >
                {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            )}
          </div>
          {/* The rules, ticked off as they are met. */}
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className={cn(
                  "flex items-center gap-1.5",
                  rule.met && password ? "text-emerald-700" : "text-muted-foreground",
                )}
              >
                {rule.met && password ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Circle className="h-3 w-3 shrink-0" />
                )}
                {rule.label}
              </li>
            ))}
          </ul>
        </div>
        {!single && (
          <label className="text-sm">
            <span className={phone ? FIELD_LABEL : "mb-1 block font-medium text-foreground"}>
              {t.passwordForm.confirm}
            </span>
            <input
              id={confirmId}
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearLocalError();
              }}
              className={inputClass}
            />
          </label>
        )}
        {(localError || error) && <Notice tone="error">{localError ?? error}</Notice>}
        <div className={phone ? "flex flex-col items-center gap-3" : "flex items-center gap-3"}>
          {phone ? (
            // The glass capsule on a phone and in the app (#161).
            <FlowButton type="submit" busy={busy}>
              {checking ? t.passwordForm.checking : submitting ? submittingLabel : submitLabel}
            </FlowButton>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {checking ? t.passwordForm.checking : submitting ? submittingLabel : submitLabel}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {t.common.cancel}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
