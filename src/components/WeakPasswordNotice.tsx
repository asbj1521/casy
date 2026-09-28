import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";

import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { clearWeakPassword, subscribeWeakPassword, weakPasswordUserId } from "@/lib/weakPassword";

/**
 * A slim note above every page after signing in with a password that no
 * longer meets Casy's rules (src/lib/weakPassword.ts), pointing to the
 * profile's password form. Nobody is locked out: it can be dismissed.
 */
export default function WeakPasswordNotice() {
  const t = useT();
  const { user } = useAuth();
  const flagged = useSyncExternalStore(subscribeWeakPassword, weakPasswordUserId, () => null);
  if (!user || flagged !== user.id) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          {t.weakPasswordNotice.message}{" "}
          <Link to="/profile?password=new" className="font-semibold underline underline-offset-2">
            {t.weakPasswordNotice.action}
          </Link>
        </span>
        <button
          type="button"
          onClick={clearWeakPassword}
          aria-label={t.weakPasswordNotice.dismiss}
          title={t.weakPasswordNotice.dismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
