import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";

import { useAuth } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { clearWeakPassword, subscribeWeakPassword, weakPasswordUserId } from "@/lib/weakPassword";

/**
 * A slim note above every page after signing in with a password that no
 * longer meets Casy's rules (src/lib/weakPassword.ts), pointing to the
 * profile's password form. Nobody is locked out: it can be dismissed. On a
 * phone it floats over the page, under the status bar, since the home page's
 * glass header would otherwise cover it (#147).
 */
export default function WeakPasswordNotice() {
  const t = useT();
  const { user } = useAuth();
  const flagged = useSyncExternalStore(subscribeWeakPassword, weakPasswordUserId, () => null);
  const phone = usePhoneLayout();
  if (!user || flagged !== user.id) return null;

  return (
    <div
      className={
        phone
          ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-lg"
          : "border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8"
      }
    >
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
