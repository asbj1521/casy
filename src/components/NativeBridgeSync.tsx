import { useEffect, useState } from "react";

import { useAuth } from "@/context/auth";
import { useLang } from "@/i18n/lang";
import { lendSession, onNativeChoice, sharePreferences } from "@/lib/nativeBridge";
import { chooseTheme, onThemeChange, storedTheme } from "@/lib/theme";

/**
 * Keeps the app's native screens in step with the page (#196): the login on
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
    void onNativeChoice((choice) => {
      setLang(choice.lang);
      if (choice.theme !== storedTheme()) chooseTheme(choice.theme);
    }).then((h) => {
      if (gone) void h.remove();
      else handle = h;
    });
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [setLang]);

  return null;
}
