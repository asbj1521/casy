import { useEffect } from "react";

import { useAuth } from "@/context/auth";
import { useLang } from "@/i18n/lang";
import { supabaseAuth } from "@/lib/supabase";

/**
 * Keeps the language saved on the signed-in account (`user_metadata.lang`)
 * the same as the one the site is in, so the emails Supabase Auth sends with
 * no page to ask (the security code before a password change, "your password
 * was changed") come in it too: the auth-email hook reads it. Emails asked for
 * from the sign-in page carry the page's language themselves.
 *
 * Saved only when it differs, so once per account and per switch, not on
 * every visit. A failure is left alone: the next visit tries again, and until
 * then the emails fall back to Danish.
 */
export function useAccountLanguage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const saved = user?.user_metadata?.lang;

  useEffect(() => {
    if (!user || saved === lang) return;
    void supabaseAuth.updateUser({ data: { lang } }).catch(() => {});
  }, [user, saved, lang]);
}
