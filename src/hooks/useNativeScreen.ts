import { useEffect, useState } from "react";

import { nativeScreens, type NativeScreen } from "@/lib/nativeBridge";

/**
 * Whether the app draws `screen` natively (#198): false on the website, from
 * an app without it, and until the app has answered (asked once per launch).
 */
export function useNativeScreen(screen: NativeScreen): boolean {
  const [native, setNative] = useState(false);
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
