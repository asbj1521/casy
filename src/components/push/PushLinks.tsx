import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import PushAsk from "@/components/push/PushAsk";
import { useAuth } from "@/context/auth";
import { useLang } from "@/i18n/lang";
import { onNotificationTap, refreshPush } from "@/lib/push";

/**
 * Push notifications' part of the page (#139), in the app only (App.tsx loads
 * it there, so the website never downloads it): a tap on a notification
 * opens the screen it is about, the phone registers again each time the app
 * opens signed in (its token can change), and Casy's question about
 * notifications is shown where it belongs (PushAsk).
 */
export default function PushLinks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();
  const userId = user?.id;

  useEffect(() => {
    let stop = () => {};
    let gone = false;
    // An app build without the push plugin simply has no taps to open.
    onNotificationTap((path) => navigate(path)).then(
      (remove) => {
        if (gone) remove();
        else stop = remove;
      },
      () => {},
    );
    return () => {
      gone = true;
      stop();
    };
  }, [navigate]);

  useEffect(() => {
    if (userId) void refreshPush(lang).catch(() => {});
  }, [userId, lang]);

  return <PushAsk />;
}
