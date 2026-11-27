import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey } from "@/api/events";
import { friendsQueryKey, groupsQueryKey, invitationsQueryKey, whoAmIQueryKey } from "@/api/groups";
import { blockedQueryKey } from "@/api/safety";

import { useAuth } from "@/context/auth";
import { useLang } from "@/i18n/lang";
import {
  lendSession,
  onEnablePush,
  onNativeChoice,
  onNativeDataChanged,
  onNativeAiConsent,
  onNativeCalendarsChanged,
  onNativeInviteSent,
  onNativePhoneForgotten,
  onAppPhoneConnection,
  onNeedPhoneFacts,
  onNeedPhoneSync,
  onNeedPhoneWrite,
  onNativeAuthAsk,
  onNeedSession,
  sharePreferences,
  onAppTakesSession,
} from "@/lib/nativeBridge";
import { answerNativeAuth } from "@/lib/nativeAuth";
import { afterAiConsent } from "@/hooks/useAiConsentSetting";
import { labelBookQuery } from "@/hooks/useEventLabels";
import { syncPhone } from "@/hooks/usePhoneCalendarSync";
import { rememberInviteSent } from "@/lib/groupNudge";
import { calendarsChanged } from "@/api/calendars";
import {
  deviceId,
  forgetPhone,
  phoneConnectionId,
  rememberPhoneConnection,
} from "@/lib/phoneCalendar";
import { enablePush } from "@/lib/push";
import { authOptions, supabaseAuth } from "@/lib/supabase";
import { chooseTheme, onThemeChange, storedTheme } from "@/lib/theme";

/**
 * Keeps the app's native screens in step with the page (#198): the login on
 * every change (sign-in, each refresh, sign-out), and the language and theme
 * the page uses. A choice made on a native screen comes back and is applied
 * the way the page's own Settings rows apply it. Mounted in AppBackground, so
 * only in the app.
 */
export default function NativeBridgeSync() {
  const { session } = useAuth();
  const { lang, setLang } = useLang();
  const [theme, setTheme] = useState(storedTheme);

  useEffect(() => onThemeChange(() => setTheme(storedTheme())), []);

  // The app's own sign-in screen (#282): each step is done here, where the session is.
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeAuthAsk(answerNativeAuth)
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch(() => {});
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, []);

  useEffect(() => {
    const lent = session
      ? {
          accessToken: session.access_token,
          expiresAt: session.expires_at ?? 0,
          userId: session.user.id,
          email: session.user.email,
        }
      : null;
    // This phone's connection too, for the app's own labels (#282); a new one
    // after this reaches the app from the phone's sync.
    const connection = session ? phoneConnectionId(session.user.id) : null;
    lendSession(lent, { connection, deviceId: deviceId() }).catch((err) =>
      console.warn("lending the app the login failed", err),
    );
  }, [session]);

  useEffect(() => {
    sharePreferences({ lang, theme }).catch((err) =>
      console.warn("telling the app the preferences failed", err),
    );
  }, [lang, theme]);

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeChoice((choice) => {
      setLang(choice.lang);
      if (choice.theme !== storedTheme()) chooseTheme(choice.theme);
    })
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening to the app's screens failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [setLang]);

  // A native screen changed your name, picture, groups, invitations or friends: the
  // page's copies, and the lists they are in, are fetched again.
  const queryClient = useQueryClient();
  const youId = session?.user.id;
  useEffect(() => {
    if (!youId) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeDataChanged(() => {
      for (const queryKey of [
        whoAmIQueryKey(youId),
        groupsQueryKey(youId),
        eventsQueryKey(youId),
        invitationsQueryKey(youId),
        blockedQueryKey(youId),
        friendsQueryKey(youId),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    })
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening for the app's changes failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [queryClient, youId]);

  // Someone was invited from a native screen: the home page's nudge to invite
  // people to that group goes, as it does after the page's own Invite.
  useEffect(() => {
    if (!youId) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeInviteSent((groupId) => rememberInviteSent(youId, groupId))
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening for the app's invites failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [youId]);

  // Native Dine data (#198): its AI switch is followed up here, where the
  // labels and trips live, and it asks how many labels this phone keeps.
  useEffect(() => {
    if (!youId) return;
    const handles: { remove: () => Promise<void> }[] = [];
    let gone = false;
    const keep = (h: { remove: () => Promise<void> }) => {
      if (gone) void h.remove();
      else handles.push(h);
    };
    onNativeAiConsent((on) => afterAiConsent(queryClient, youId, on))
      .then(keep)
      .catch((err) => console.warn("listening for the app's AI switch failed", err));
    onNeedPhoneFacts(async () => {
      const book = await queryClient.fetchQuery(labelBookQuery(youId));
      return { labels: Object.keys(book ?? {}).length };
    })
      .then(keep)
      .catch((err) => console.warn("answering the app's Dine data failed", err));
    // Native Aftaler (#199) put an event into a calendar on this phone: the
    // page writes the phone's calendar, as its own Tilføj til min kalender does.
    onNeedPhoneWrite(async () => {
      if (phoneConnectionId(youId)) await syncPhone(queryClient, youId, { create: false });
    })
      .then(keep)
      .catch((err) => console.warn("listening for the app's calendar writes failed", err));
    // Native Kalendere (#200): what it changed is fetched again here, the
    // phone's calendars are sent by the page, and this phone removed is forgotten.
    onNativeCalendarsChanged(() => {
      void calendarsChanged(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["primary-calendar"] });
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(youId) });
    })
      .then(keep)
      .catch((err) => console.warn("listening for the app's calendars failed", err));
    onNeedPhoneSync(async (create) => {
      try {
        const outcome = await syncPhone(queryClient, youId, { create });
        return { ...outcome, connectionId: phoneConnectionId(youId) };
      } catch (err) {
        return {
          state: "failed" as const,
          error: err instanceof Error ? err.message : String(err),
          connectionId: phoneConnectionId(youId),
        };
      }
    })
      .then(keep)
      .catch((err) => console.warn("listening for the app's phone sync failed", err));
    onAppPhoneConnection(({ userId, connectionId }) => {
      if (userId === youId) rememberPhoneConnection(userId, connectionId);
    })
      .then(keep)
      .catch((err) => console.warn("listening for the app's phone connection failed", err));
    onNativePhoneForgotten(() => forgetPhone(youId))
      .then(keep)
      .catch((err) => console.warn("listening for the app's phone removal failed", err));
    return () => {
      gone = true;
      for (const h of handles) void h.remove();
    };
  }, [queryClient, youId]);

  // A native screen's token ran out: getSession() refreshes it, and the change
  // comes back above through `session`.
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNeedSession(() => void supabaseAuth.getSession())
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening for the app's login failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, []);

  // The app taking the login over (#202, Debug): the page stops refreshing and forgets it.
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onAppTakesSession(async () => {
      await supabaseAuth.stopAutoRefresh();
      const key = authOptions(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      ).storageKey;
      const session = localStorage.getItem(key);
      localStorage.removeItem(key);
      return session;
    })
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch(() => {});
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, []);

  // Turning notifications on from a native screen: always in the language now.
  const langNow = useRef(lang);
  useEffect(() => {
    langNow.current = lang;
  }, [lang]);
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onEnablePush(() => enablePush(langNow.current))
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening for notifications failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, []);

  return null;
}
