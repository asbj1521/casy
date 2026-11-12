import { useEffect } from "react";
import { APP_NAME } from "@/i18n/brand";

/**
 * The browser tab's title for a page: "Mine aftaler · Casy", so tabs and the
 * history can be told apart. Back to plain "Casy" when the page goes, for
 * pages that don't set one (the landing page).
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
