import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";

import { deleteMyAccount } from "@/api/account";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { useT } from "@/i18n/lang";
import { supabase } from "@/lib/supabase";

/**
 * "Delete account" at the bottom of the profile: says what goes and what
 * stays, then asks for a typed word before anything happens, since it can't
 * be undone. Afterwards the browser's session is dropped and the sign-in
 * page says the account is gone.
 */
export default function DeleteAccountSection() {
  const t = useT();
  const words = t.deleteAccount;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toUpperCase() === words.word;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
    } catch (err) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : words.failed);
      return;
    }
    // The account is gone, so its session is too: forget it here. Supabase
    // accepts that the server no longer knows it, and signs this browser out.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    navigate("/sign-in?deleted=1", { replace: true });
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{words.title}</h2>
      <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-sm text-muted-foreground">{words.intro}</p>
        {open ? (
          <ConfirmPanel
            className="mt-4"
            message={<span className="font-medium">{words.prompt(words.word)}</span>}
            confirmLabel={
              <>
                {!deleting && <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? words.deleting : words.confirmButton}
              </>
            }
            busy={deleting}
            error={error}
            confirmDisabled={!confirmed}
            onConfirm={() => void handleDelete()}
            onCancel={() => {
              setOpen(false);
              setTyped("");
              setError(null);
            }}
          >
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              aria-label={words.prompt(words.word)}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-2 block w-40 rounded-lg border border-red-200 bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-red-300"
            />
          </ConfirmPanel>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-full border border-red-200 bg-background px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            {words.button}
          </button>
        )}
      </div>
    </section>
  );
}
