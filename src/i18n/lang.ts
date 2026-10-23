import { createContext, useContext } from "react";

import { MESSAGES } from "@/i18n/current";
import type { Messages } from "@/i18n/da";
import { LOCALE, type Lang } from "@/i18n/locale";

export { LOCALE, type Lang };

export const LANG_STORAGE_KEY = "casy-lang";

function asLang(value: string | null | undefined): Lang | null {
  return value === "da" || value === "en" ? value : null;
}

/**
 * Danish unless this visit or an earlier one chose English. `?lang=` wins over
 * the remembered choice, so a link like /privacy?lang=en always opens in English.
 */
/**
 * The language to start in: `?lang=`, else the one chosen before, else
 * `fallback` (Danish on the website; the phone's in the app, phoneLang).
 */
export function initialLang(search: string, stored: string | null, fallback: Lang = "da"): Lang {
  return asLang(new URLSearchParams(search).get("lang")) ?? asLang(stored) ?? fallback;
}

/**
 * The iPhone app's first language (#151): Danish when the phone lists Danish
 * among its languages at all, else English. Danes with an English iPhone often
 * keep Danish as a second language, so Danish wins wherever it appears.
 */
export function phoneLang(languages: readonly string[]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith("da")) ? "da" : "en";
}

export interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: "da",
  setLang: () => {},
});

export function useLang() {
  const { lang, setLang } = useContext(LanguageContext);
  return { lang, setLang, locale: LOCALE[lang] };
}

/** The current language's copy: `const t = useT(); t.nav.profile`. */
export function useT(): Messages {
  return MESSAGES[useContext(LanguageContext).lang];
}
