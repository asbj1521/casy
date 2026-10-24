import { da, type Messages } from "@/i18n/da";
import type { Lang } from "@/i18n/locale";

/**
 * Each language's copy, as far as loaded. Danish, the default, is in the
 * first download; English is fetched when it is first needed (#157), so a
 * Danish visitor never downloads it. LanguageProvider loads it before
 * switching, so a page never asks for copy that isn't here.
 */
const loaded: Partial<Record<Lang, Messages>> = { da };

/** The copy for `lang`; Danish while another language is still on its way. */
export function messagesFor(lang: Lang): Messages {
  return loaded[lang] ?? da;
}

export function isLoaded(lang: Lang): boolean {
  return loaded[lang] !== undefined;
}

/** Fetch a language's copy once; Danish is always there. */
export async function loadMessages(lang: Lang): Promise<void> {
  if (loaded[lang]) return;
  if (lang === "en") loaded.en = (await import("@/i18n/en")).en;
}

/**
 * The page's language for code that runs outside React: the API helpers'
 * fallback messages, and the `lang` sent to every Edge Function so its own
 * messages come back in the same language. LanguageProvider keeps it in step.
 */
let current: Lang = "da";

export function setCurrentLang(lang: Lang) {
  current = lang;
}

export function currentLang(): Lang {
  return current;
}

/** The current language's copy, for the same code. */
export function currentMessages(): Messages {
  return messagesFor(current);
}
