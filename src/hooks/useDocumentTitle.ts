import { useEffect } from "react";
import { appName } from "@/i18n/brand";
import { useLang } from "@/i18n/lang";

/**
 * The browser tab's title for a page: "Mine aftaler · Casy", so tabs and the
 * history can be told apart. Back to plain "Casy" when the page goes, for
 * pages that don't set one (the landing page).
 */
export function useDocumentTitle(title: string): void {
  const { lang } = useLang();
  useEffect(() => {
    document.title = `${title} · ${appName(lang)}`;
    return () => {
      document.title = appName(lang);
    };
  }, [title, lang]);
}
