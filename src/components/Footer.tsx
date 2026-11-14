import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { appName } from "@/i18n/brand";
import { useLang, useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * The bottom of every page: how Casy works, the terms, and the privacy link,
 * which has to be reachable from the home page for Google's consent screen.
 * Not in the iPhone app, whose profile lists all three (HelpGroup), and not
 * on a signed-in phone either: its profile lists them too, and a footer
 * under a page that is shorter than the screen showed up above the old tab
 * bar on some pages and not on others. Signed out, a phone keeps it, but its
 * front page has the same links on the welcome screen itself (#278).
 */
export default function Footer() {
  const t = useT();
  const { lang } = useLang();
  const { user, loading } = useAuth();
  const phone = usePhoneLayout();
  const { pathname } = useLocation();
  // Signed out, a phone's front page is the app's welcome (#278), with these links on it.
  const hidden = isNativeApp || (phone && (loading || !!user || pathname === "/"));
  // Pages sized to the screen leave room for the footer (--footer-height in index.css).
  useEffect(() => {
    document.documentElement.classList.toggle("no-footer", hidden);
    return () => document.documentElement.classList.remove("no-footer");
  }, [hidden]);
  if (hidden) return null;
  return (
    <footer className="border-t bg-background">
      {/* The same edge-to-edge gutter as the nav, so both ends line up with it. */}
      <div className="flex items-center justify-between px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <span>{appName(lang)}</span>
        <div className="flex items-center gap-5">
          <Link to="/how-it-works" className="transition hover:text-foreground">
            {t.footer.howItWorks}
          </Link>
          <Link to="/terms" className="transition hover:text-foreground">
            {t.footer.terms}
          </Link>
          <Link to="/privacy" className="transition hover:text-foreground">
            {t.footer.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}
