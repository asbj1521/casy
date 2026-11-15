import { useEffect, useRef } from "react";

import {
  onNativeClosed,
  openNativeScreen,
  type NativeClosed,
  type NativeScreen,
} from "@/lib/nativeBridge";

/**
 * Opens the app's native `screen` while `open` (#198, #199), and hands its
 * closing to `onClosed`: the latest one passed, so it may change each render.
 * If the app can't open it, `onFailed` puts the page back as it was.
 */
export function useNativeSheet(
  screen: NativeScreen,
  open: boolean,
  onClosed: (closed: NativeClosed) => void,
  onFailed: () => void,
): void {
  const closedNow = useRef(onClosed);
  const failedNow = useRef(onFailed);
  useEffect(() => {
    closedNow.current = onClosed;
    failedNow.current = onFailed;
  });

  useEffect(() => {
    if (!open) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeClosed((closed) => {
      if (closed.screen === screen) closedNow.current(closed);
    })
      .then(async (h) => {
        if (gone) return void h.remove();
        handle = h;
        await openNativeScreen(screen);
      })
      .catch((err) => {
        console.warn(`opening the native ${screen} failed`, err);
        failedNow.current();
      });
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [open, screen]);
}
