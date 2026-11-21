import { useEffect, useState } from "react";

import { isNativeApp } from "@/lib/nativeApp";
import { nativeScreens, type NativeScreen } from "@/lib/nativeBridge";

/**
 * Whether the app draws `screen` natively (#198): false on the website, from
 * an app without it, and until the app has answered (asked once per launch).
 */
export function useNativeScreen(screen: NativeScreen): boolean {
  return useNativeScreenKnown(screen) ?? false;
}

/**
 * The same, but null until the app has answered: for a sheet that must not
 * show the page's own first and then swap to the app's.
 */
export function useNativeScreenKnown(screen: NativeScreen): boolean | null {
  // The website has no app to ask: false at once, so nothing waits a frame.
  const [native, setNative] = useState<boolean | null>(isNativeApp ? null : false);
  useEffect(() => {
    let live = true;
    void nativeScreens().then((all) => {
      if (live) setNative(all.has(screen));
    });
    return () => {
      live = false;
    };
  }, [screen]);
  return native;
}
