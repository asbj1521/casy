import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useSignedInUser } from "@/context/auth";
import { useNativeSheet } from "@/hooks/useNativeSheet";
import { onNativeCalendarPrefs } from "@/lib/nativeBridge";
import { phoneConnectionId } from "@/lib/phoneCalendar";

/**
 * Kalendere when the app draws it (#200): nothing on the page, only the native
 * sheet opened while the address says `?calendars`, on the screen the address
 * names (`=accounts`, `=tour`), with a provider picked before arriving
 * (`connect=apple`) ready. What the page keeps on this phone goes with it, the
 * holidays' tick and the calendars the tour has been through, and comes back
 * as the native screen changes it. When it closes, the address steps back, or
 * goes on to a page the app doesn't draw yet (a help guide).
 */
export default function NativeCalendars({
  open,
  onClose,
  holidaysHidden,
  onHolidaysHidden,
  tourSeen,
  onTourSeen,
}: {
  open: boolean;
  onClose: () => void;
  holidaysHidden: boolean;
  onHolidaysHidden: (hidden: boolean) => void;
  tourSeen: ReadonlySet<string>;
  onTourSeen: (seen: Set<string>) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useSignedInUser().id;
  const params = new URLSearchParams(location.search);
  useNativeSheet(
    "calendars",
    open,
    ({ next }) => {
      if (next) navigate(next, { replace: true, state: location.state });
      else onClose();
    },
    onClose,
    () => ({
      start: params.get("calendars") || null,
      connect: params.get("connect"),
      holidaysHidden,
      tourSeen: [...tourSeen],
      thisPhone: phoneConnectionId(userId),
    }),
  );

  const apply = useRef({ onHolidaysHidden, onTourSeen });
  useEffect(() => {
    apply.current = { onHolidaysHidden, onTourSeen };
  });
  useEffect(() => {
    if (!open) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeCalendarPrefs((prefs) => {
      if (prefs.holidaysHidden !== undefined) apply.current.onHolidaysHidden(prefs.holidaysHidden);
      if (prefs.tourSeen) apply.current.onTourSeen(new Set(prefs.tourSeen));
    })
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening to native Kalendere failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [open]);
  return null;
}
