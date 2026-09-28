import { useId, useState, type FormEvent } from "react";
import { KeyRound, Loader2, XCircle } from "lucide-react";

import { useT } from "@/i18n/lang";

/**
 * The second step of changing a password when the last sign-in was more
 * than a day ago (secure_password_change in supabase/config.toml): Supabase
 * has emailed a code, and the new password is saved together with it. This
 * is what stops someone at an unlocked computer from changing the password
 * and locking its owner out.
 */
export default function PasswordCodeStep({
  email,
  submitting,
  error,
  resent,
  onSubmit,
  onResend,
  onCancel,
}: {
  email: string;
  submitting: boolean;
  error: string | null;
  /** A new code was just sent. */
  resent: boolean;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [code, setCode] = useState("");
  const codeId = useId();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-foreground">{t.profile.codeSent(email)}</p>
      <label htmlFor={codeId} className="text-sm">
        <span className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          {t.profile.codeLabel}
        </span>
        <input
          id={codeId}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-40 rounded-lg border bg-background px-3 py-2 text-lg tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t.profile.saving : t.profile.savePassword}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onResend}
          className="text-sm text-muted-foreground underline underline-offset-2 transition hover:text-foreground disabled:opacity-60"
        >
          {resent ? t.profile.codeResent : t.profile.codeResend}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onCancel}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
