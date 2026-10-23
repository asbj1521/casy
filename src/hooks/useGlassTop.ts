import { useEffect } from "react";

import { isNativeApp } from "@/lib/nativeApp";

/**
 * In the iPhone app, lets a page scroll under the clock: the app's solid
 * strip over the status bar (`body::before`, index.css) is switched off while
 * the page is open, and the page draws its own translucent header up there.
 * Nothing on the website, which has no status bar of its own.
 */
export function useGlassTop() {
  useEffect(() => {
    if (!isNativeApp) return;
    const root = document.documentElement;
    root.classList.add("glass-top");
    return () => root.classList.remove("glass-top");
  }, []);
}
