import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { setCurrentLang } from "@/i18n/current";
import { initialLang, LANG_STORAGE_KEY, LanguageContext, type Lang } from "@/i18n/lang";
import { readStored, writeStored } from "@/lib/storage";

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const first = initialLang(window.location.search, readStored(LANG_STORAGE_KEY));
    setCurrentLang(first);
    return first;
  });

  const setLang = useCallback((next: Lang) => {
    // Set before the re-render, so a request made during it already asks in
    // the new language.
    setCurrentLang(next);
    setLangState(next);
    // Not remembered in a private window; the choice then lasts the visit.
    writeStored(LANG_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
