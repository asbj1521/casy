import { useNativeSheet } from "@/hooks/useNativeSheet";

/**
 * Log ind when the app draws it (#282): a screen of its own over the welcome,
 * opened on making an account (`signup`) or on logging in. Each step is done by
 * the page (nativeAuth.ts), so a sign-in that works changes the page's login
 * and the page goes on as from its own. Closed without signing in, the
 * welcome is as it was (`onClose`).
 */
export default function NativeSignIn({
  open,
  signup,
  onClose,
}: {
  open: boolean;
  signup: boolean;
  onClose: () => void;
}) {
  useNativeSheet(
    "signIn",
    open,
    ({ signedIn }) => {
      if (!signedIn) onClose();
    },
    onClose,
    () => ({ signup }),
  );
  return null;
}

/**
 * The welcome screen when the app draws it (#282): the intro, the animation
 * and the ways in, the sign-in over it, all native; opened at once on sign-in
 * (`signIn`) from an invite's way in. "Indsæt link" comes back here
 * (`onPaste`), to the page's own sheet for it.
 */
export function NativeWelcome({
  open,
  signIn,
  onPaste,
}: {
  open: boolean;
  signIn: "signin" | "signup" | null;
  onPaste: () => void;
}) {
  useNativeSheet(
    "welcome",
    open,
    ({ paste }) => {
      if (paste) onPaste();
    },
    () => {},
    () => (signIn ? { signIn } : {}),
  );
  return null;
}
