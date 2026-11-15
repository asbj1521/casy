import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/auth";
import { useNativeSheet } from "@/hooks/useNativeSheet";
import { askForPush } from "@/lib/pushAsk";
import { supabaseAuth } from "@/lib/supabase";

/**
 * The Profil list when the app draws it (#198): nothing on the page, only the
 * native sheet opened while the address says `?profile`. When it closes, the
 * address steps back, or goes on to a screen still drawn by the page. The page
 * signs out, as it owns the login, and offers notifications after a join.
 */
export default function NativeProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  useNativeSheet(
    "profile",
    open,
    ({ next, signOut: out, joined, accountDeleted }) => {
      if (accountDeleted) {
        // As DeleteAccountSection: the server no longer knows the login, so only this
        // device forgets it, and the sign-in page says the account is gone.
        void supabaseAuth
          .signOut({ scope: "local" })
          .catch(() => undefined)
          .then(() => navigate("/sign-in?deleted=1", { replace: true }));
      } else if (out) {
        signOut()
          .then(() => navigate("/"))
          .catch(() => onClose()); // still signed in (offline): back to the page
      } else if (joined) {
        // As the page's own invitation does (useInvitationAnswers, #139, #230).
        onClose();
        askForPush("joined");
      } else if (next) {
        navigate(next, { replace: true });
      } else {
        onClose();
      }
    },
    onClose,
  );
  return null;
}
