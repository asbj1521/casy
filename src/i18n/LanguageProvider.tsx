import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { isLoaded, loadMessages, setCurrentLang } from "@/i18n/current";
import { initialLang, LANG_STORAGE_KEY, LanguageContext, phoneLang, type Lang } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";
import { readStored, writeStored } from "@/lib/storage";

/**
 * The page's language. Danish is always loaded; English is fetched the first
 * time it is needed (#157), before the page switches to it, so nothing is
 * ever drawn half in one language. A page starting in English shows the
 * plain background for that moment, as a lazy page does.
 */
export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    // The app starts in the phone's language (#151); the website in Danish.
    const fallback = isNativeApp ? phoneLang(navigator.languages ?? [navigator.language]) : "da";
    const first = initialLang(window.location.search, readStored(LANG_STORAGE_KEY), fallback);
    setCurrentLang(first);
    return first;
  });
  // Bumped when a language arrives, so the page is drawn in it.
  const [, setArrived] = useState(0);

  useEffect(() => {
    if (isLoaded(lang)) return;
    loadMessages(lang).then(
      () => setArrived((n) => n + 1),
      // Offline, say: Danish rather than a blank page.
      () => {
        setCurrentLang("da");
        setLangState("da");
      },
    );
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    const apply = () => {
      // Set before the re-render, so a request made during it already asks in
      // the new language.
      setCurrentLang(next);
      setLangState(next);
      // Not remembered in a private window; the choice then lasts the visit.
      writeStored(LANG_STORAGE_KEY, next);
    };
    if (isLoaded(next)) apply();
    else void loadMessages(next).then(apply, () => {});
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  if (!isLoaded(lang)) return <div className="min-h-screen bg-background" />;
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
