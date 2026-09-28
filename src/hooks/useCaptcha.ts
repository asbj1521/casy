/**
 * Cloudflare Turnstile on the sign-in page: proof that a person, not a
 * script, is asking Supabase to send an email or try a password. Without it,
 * a script could send sign-in emails to any address (spam from Casy's own
 * domain) until the hourly email limit is used up for everyone.
 *
 * Supabase checks the token itself once CAPTCHA protection is switched on in
 * its dashboard. With no site key (VITE_TURNSTILE_SITE_KEY) there is no
 * widget and no token, and every call works as before, which is what makes
 * switching it on safe: the site sends tokens first, Supabase starts
 * requiring them after.
 *
 * The widget stays invisible unless Cloudflare wants a click. A token works
 * once, so call reset() after each auth call.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { Lang } from "@/i18n/locale";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

/** Load Cloudflare's script once, however many times it is asked for. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    script.onerror = () => {
      loading = null; // let a later page try again
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export interface Captcha {
  /** False when no site key is set: no widget, and calls go without a token. */
  enabled: boolean;
  /** The current one-time token, or null while there is none (yet). */
  token: string | null;
  /** Cloudflare's script couldn't load or the check failed (an ad blocker, say). */
  failed: boolean;
  /** Pass as `ref` to the element the widget lives in (a callback, not a ref object). */
  attach: (element: HTMLDivElement | null) => void;
  /** Use after every auth call: a token only works once. */
  reset: () => void;
}

export function useCaptcha(lang: Lang): Captcha {
  // A callback ref, not useRef: the sign-in page renders its forms only once
  // the session is known, and the widget must appear when they do.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !container) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId.current = turnstile.render(container, {
          sitekey: SITE_KEY,
          language: lang,
          appearance: "interaction-only",
          size: "flexible",
          callback: (value: string) => {
            setFailed(false);
            setToken(value);
          },
          "expired-callback": () => setToken(null),
          "error-callback": () => {
            setToken(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [container, lang]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  return { enabled: !!SITE_KEY, token, failed, attach: setContainer, reset };
}
