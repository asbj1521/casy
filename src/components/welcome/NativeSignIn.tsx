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
