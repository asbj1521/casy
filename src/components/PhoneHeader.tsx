import { Link } from "react-router-dom";

import LanguageToggle from "@/components/LanguageToggle";
import { useAuth } from "@/context/auth";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * TopNav on a phone: just the logo (and, signed out, the language switch), kept
 * at the top while the page scrolls under it. The links live in the tab bar
 * (TabBar). vt-top-nav: it holds still while the landing page turns into
 * another page (cardTransition.ts). In the app it sticks below the clock, not
 * under it.
 *
 * The iPhone app has no logo (#129): you know which app you opened, so the
 * pages start at the top. Signed in there is no header at all, only a little
 * room under the clock; signed out, only the language switch.
 */
export default function PhoneHeader() {
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
      {showSwitch && <LanguageToggle />}
    </header>
  );
}
