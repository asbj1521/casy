import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/auth-js";

import { AuthContext, type AuthState } from "@/context/auth";
import { authErrorMessage } from "@/i18n/authError";
import { currentMessages } from "@/i18n/current";
import { addressAfterLink, emailLinkIn } from "@/lib/emailLink";
import { clearPersistedQueries } from "@/lib/queryPersistence";
import { isNativeApp } from "@/lib/nativeApp";
import { supabaseAuth } from "@/lib/supabase";

/**
 * An auth email's link this page was opened with (#202), used once: the
 * effect below can run twice in development, and the token works only once.
 */
let emailLinkUsed = false;

/**
 * Holds the current session and keeps it in step with Supabase.
 *
 * `onAuthStateChange` fires once straight away with whatever session is
 * stored (or none), and again on every sign-in, sign-out and token refresh,
 * so it is the only thing that ever writes the session here. It also covers
 * the return from Google or an email link: the client reads the login out of
 * the URL on startup and reports it through the same event.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  // An auth email's link being checked: still loading, so nobody is sent to sign in meanwhile.
  const [checkingLink, setCheckingLink] = useState(
    () => !emailLinkUsed && emailLinkIn(window.location.search) !== null,
  );

  useEffect(() => {
    const { data } = supabaseAuth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      // Fires when the browser lands on a password-reset link: it carries a
      // real session, but the sign-in page needs to show a "new password"
      // form rather than treating this as an ordinary login.
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      // Cached answers belong to whoever asked for them. Dropping them on
      // sign-out means the next person on this browser never sees them.
      // The copies remembered on the device go with them.
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        clearPersistedQueries();
        // Loaded only now: the labels code isn't part of the first download (#157).
        void import("@/lib/eventLabels").then((m) => m.clearLabelBooks());
        // And the app's own, once it labels itself (#282).
        if (isNativeApp) void import("@/lib/nativeBridge").then((m) => m.clearAppPhoneAi(null));
      }
    });
    // An auth email's link (#202): signed in with its token, reported through the
    // listener above (a password reset as PASSWORD_RECOVERY), the token then taken
    // out of the address; a link that failed says why on the sign-in page.
    const link = emailLinkUsed ? null : emailLinkIn(window.location.search);
    if (link) {
      emailLinkUsed = true;
      void supabaseAuth
        .verifyOtp({ token_hash: link.tokenHash, type: link.type })
        .then(({ error }) => {
          const reason = error ? authErrorMessage(error, currentMessages()) : undefined;
          window.history.replaceState(null, "", addressAfterLink(window.location.href, reason));
        })
        .finally(() => setCheckingLink(false));
    }
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading: loading || checkingLink,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      signOut: async (scope = "local") => {
        // Supabase answers a failure (offline, say) with an error rather than
        // throwing, and keeps the session: say so, so no button pretends.
        // This phone's notifications stop with the sign-out, while the login
        // can still say whose they were (#139); never in the way of it.
        if (isNativeApp) await import("@/lib/push").then((m) => m.forgetPush()).catch(() => {});
        const { error } = await supabaseAuth.signOut({ scope });
        if (error) throw error;
      },
    }),
    [session, loading, checkingLink, passwordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
