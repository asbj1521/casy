import { useState } from "react";
import { isAuthError } from "@supabase/auth-js";
import { Loader2 } from "lucide-react";
import { SiApple } from "react-icons/si";

import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { authErrorMessage } from "@/i18n/authError";
import { useT } from "@/i18n/lang";
import { hasAppleSignIn, linkAppleSignIn } from "@/lib/appleSignIn";

/**
 * Apple as a second way into this account (#245), under Log ind og sikkerhed in
 * the app: someone who came in with Google or email adds it, and from then on
 * Sign in with Apple leads here, whatever address Apple gives, instead of
 * making a second, empty account. Says so once it is there.
 */
export default function AppleSignInRow() {
  const t = useT();
  const words = t.appleLink;
  const user = useSignedInUser();
  const [linked, setLinked] = useState(() => hasAppleSignIn(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      if ((await linkAppleSignIn()) === "linked") setLinked(true);
    } catch (err) {
      setError(isAuthError(err) ? authErrorMessage(err, t) : t.signIn.appleFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ListGroup className="mt-6">
        <ListRow
          leading={<SiApple aria-hidden className="h-5 w-5 text-foreground" />}
          label={words.label}
          value={
            linked ? (
              words.added
            ) : busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <span className="font-semibold text-primary">{words.add}</span>
            )
          }
          onClick={linked || busy ? undefined : () => void add()}
        />
      </ListGroup>
      {!linked && (
        <p className="mt-2 px-1 text-[0.75rem] text-muted-foreground">{words.footnote}</p>
      )}
      {error && (
        <Notice tone="error" className="mt-2">
          {error}
        </Notice>
      )}
    </>
  );
}
