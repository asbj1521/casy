import { useId, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Circle, Loader2, Lock, XCircle } from "lucide-react";

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
 */
export default function PasswordForm({
  open = true,
  submitting,
  error,
  submitLabel,
  submittingLabel,
  passwordLabel,
  personal = [],
  onSubmit,
  onCancel,
}: {
  open?: boolean;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  submittingLabel: string;
  /** "New password" fits changing one; a fresh sign-up reads better as "Password". */
  passwordLabel?: string;
  /** The person's email and name, which the password mustn't be built from. */
  personal?: (string | null | undefined)[];
  onSubmit: (password: string) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
    if (password !== confirm) {
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
    <AnimatePresence initial={false}>
      {open && (
        <motion.form
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          onSubmit={(e) => void handleSubmit(e)}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3">
            <div className="text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Lock className="h-3.5 w-3.5" />
                <label htmlFor={passwordId}>{passwordLabel ?? t.passwordForm.newPassword}</label>
              </div>
              <input
                id={passwordId}
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearLocalError();
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
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
            <label className="text-sm">
              <span className="mb-1 block font-medium text-foreground">
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
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            {(localError || error) && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{localError ?? error}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {checking ? t.passwordForm.checking : submitting ? submittingLabel : submitLabel}
              </button>
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
        </motion.form>
      )}
    </AnimatePresence>
  );
}
