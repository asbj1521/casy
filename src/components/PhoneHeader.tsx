import { Link, useLocation } from "react-router-dom";

import LanguageToggle from "@/components/LanguageToggle";
import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * TopNav on a phone: just the logo (and, signed out, the language switch and
 * "Log ind"), kept at the top while the page scrolls under it. Everything else
 * is reached from the home page's buttons (HomeBar, #169). vt-top-nav: it
 * holds still while the landing page turns into another page
 * (cardTransition.ts). In the app it sticks below the clock, not under it.
 *
 * The iPhone app has no logo (#129): you know which app you opened, so the
 * pages start at the top. Signed in there is no header at all, only a little
 * room under the clock; signed out, only the language switch (its welcome
 * screen is the way to sign in).
 */
export default function PhoneHeader() {
  const t = useT();
  const { pathname } = useLocation();
  // Signed in, language is chosen in Settings (#129).
  const { user, loading } = useAuth();
  const showSwitch = !user && !loading;
  if (isNativeApp && !showSwitch) return <div aria-hidden className="vt-top-nav h-2" />;
  return (
    <header
      className={`vt-top-nav sticky top-[env(safe-area-inset-top)] z-30 flex h-12 items-center bg-background px-4 ${isNativeApp ? "justify-end" : "justify-between"}`}
    >
      {!isNativeApp && (
        <Link to="/" className="text-xl font-bold tracking-tight">
          casy
        </Link>
      )}
      {showSwitch && (
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {/* The website's way to sign in, now there is no tab bar (#169).
              Not on the landing page, which has its own under "Gå til Casy". */}
          {!isNativeApp && pathname !== "/sign-in" && pathname !== "/" && (
            <Link
              to="/sign-in"
              className="glass-pill flex h-9 items-center rounded-full px-4 text-[15px] font-semibold text-primary"
            >
              {t.nav.signIn}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
