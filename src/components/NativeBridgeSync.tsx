import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/auth";
import { useLang } from "@/i18n/lang";
import {
  lendSession,
  onEnablePush,
  onNativeChoice,
  onNeedSession,
  sharePreferences,
} from "@/lib/nativeBridge";
import { enablePush } from "@/lib/push";
import { supabaseAuth } from "@/lib/supabase";
import { chooseTheme, onThemeChange, storedTheme } from "@/lib/theme";

/**
 * Keeps the app's native screens in step with the page (#198): the login on
 * every change (sign-in, each refresh, sign-out), and the language and theme
 * the page uses. A choice made on a native screen comes back and is applied
 * the way the page's own Settings rows apply it. Mounted in AppBackground, so
 * only in the app.
 */
export default function NativeBridgeSync() {
  const { session } = useAuth();
  const { lang, setLang } = useLang();
  const [theme, setTheme] = useState(storedTheme);

  useEffect(() => onThemeChange(() => setTheme(storedTheme())), []);

  useEffect(() => {
    const lent = session
      ? {
          accessToken: session.access_token,
          expiresAt: session.expires_at ?? 0,
          userId: session.user.id,
          email: session.user.email,
        }
      : null;
    lendSession(lent).catch((err) => console.warn("lending the app the login failed", err));
  }, [session]);

  useEffect(() => {
    sharePreferences({ lang, theme }).catch((err) =>
      console.warn("telling the app the preferences failed", err),
    );
  }, [lang, theme]);

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeChoice((choice) => {
      setLang(choice.lang);
      if (choice.theme !== storedTheme()) chooseTheme(choice.theme);
    })
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening to the app's screens failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [setLang]);

  // A native screen's token ran out: getSession() refreshes it, and the change
  // comes back above through `session`.
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNeedSession(() => void supabaseAuth.getSession())
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening for the app's login failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, []);

  // Turning notifications on from a native screen: always in the language now.
  const langNow = useRef(lang);
  useEffect(() => {
    langNow.current = lang;
  }, [lang]);
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onEnablePush(() => enablePush(langNow.current))
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening for notifications failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, []);

  return null;
}
