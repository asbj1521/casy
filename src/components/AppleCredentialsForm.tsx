import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, XCircle } from "lucide-react";

import AppleCredentialFields from "@/components/AppleCredentialFields";
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
    <AnimatePresence initial={false}>
      {open && (
        <motion.form
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          onSubmit={handleSubmit}
          className="overflow-hidden"
        >
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
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{error}</p>
                  <p className="mt-1">
                    {t.appleForm.stuck(
                      <Link to={SETUP_PATH} className="font-medium underline underline-offset-2">
                        {t.appleForm.stepByStep}
                      </Link>,
                    )}
                  </p>
                </div>
              </div>
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
        </motion.form>
      )}
    </AnimatePresence>
  );
}
