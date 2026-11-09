import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/auth";
import { onNativeClosed, openNativeScreen, type NativeClosed } from "@/lib/nativeBridge";

/**
 * The Profil list when the app draws it (#198): nothing on the page, only the
 * native sheet opened while the address says `?profile`. When it closes, the
 * address steps back, or goes on to a screen still drawn by the page. The page
 * signs out, as it owns the login.
 */
export default function NativeProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const closedNow = useRef<(closed: NativeClosed) => void>(() => {});
  const closeNow = useRef(onClose);
  useEffect(() => {
    closeNow.current = onClose;
    closedNow.current = ({ next, signOut: out }) => {
      if (out) {
        signOut()
          .then(() => navigate("/"))
          .catch(() => onClose()); // still signed in (offline): back to the page
      } else if (next) {
        navigate(next, { replace: true });
      } else {
        onClose();
      }
    };
  });

  useEffect(() => {
    if (!open) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeClosed((closed) => {
      if (closed.screen === "profile") closedNow.current(closed);
    })
      .then(async (h) => {
        if (gone) return void h.remove();
        handle = h;
        await openNativeScreen("profile");
      })
      .catch((err) => {
        console.warn("opening the native Profil failed", err);
        closeNow.current();
      });
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [open]);

  return null;
}
