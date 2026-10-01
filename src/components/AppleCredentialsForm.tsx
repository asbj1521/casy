import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

import AppleCredentialFields from "@/components/AppleCredentialFields";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useT } from "@/i18n/lang";

/** The step-by-step setup, for anyone who opens this form not knowing what the password is. */
const SETUP_PATH = "/help/connect-icloud";

/**
 * Apple's sign-in form. iCloud has no consent-screen flow for calendars, so
 * connecting means an app-specific password rather than an OAuth redirect.
 *
 * Like the ICS form, it owns its fields: the page only needs to hear that the
 * form was submitted. The submitting/error state comes from the page, since it
 * belongs to the request rather than the form.
 *
 * This is the quick way, for people who know what an app-specific password
 * is. Anyone who doesn't is pointed at the step-by-step setup, under the
 * password field and again beside any error.
 */
export default function AppleCredentialsForm({
  open,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(email, password);
  }

  return (
    <Collapse open={open}>
      <form onSubmit={handleSubmit}>
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <AppleCredentialFields
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            withAboutTip
            passwordHint={t.appleForm.noPasswordYet(
              <Link
                to={SETUP_PATH}
                className="font-medium text-foreground underline underline-offset-2"
              >
                {t.appleForm.stepByStep}
              </Link>,
            )}
          />
          {error && (
            <Notice tone="error">
              <p>{error}</p>
              <p className="mt-1">
                {t.appleForm.stuck(
                  <Link to={SETUP_PATH} className="font-medium underline underline-offset-2">
                    {t.appleForm.stepByStep}
                  </Link>,
                )}
              </p>
            </Notice>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t.appleForm.reading : t.providerCard.connect}
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
        </div>
      </form>
    </Collapse>
  );
}
