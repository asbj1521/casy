import { Link } from "react-router-dom";

import LanguageToggle from "@/components/LanguageToggle";

/**
 * TopNav on a phone: just the logo and the language switch, kept at the top
 * while the page scrolls under it. The links live in the tab bar (TabBar).
 * vt-top-nav: it holds still while the landing page turns into another page
 * (cardTransition.ts). In the app it sticks below the clock, not under it.
 */
export default function PhoneHeader() {
  return (
    <header className="vt-top-nav sticky top-[env(safe-area-inset-top)] z-30 flex h-12 items-center justify-between bg-background px-4">
      <Link to="/" className="text-xl font-bold tracking-tight">
        casy
      </Link>
      <LanguageToggle />
    </header>
  );
}
