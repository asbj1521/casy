import { useEffect, useMemo, useRef } from "react";

import type { Trips } from "@/hooks/useTrips";
import { useNativeSheet } from "@/hooks/useNativeSheet";
import { useLang } from "@/i18n/lang";
import { onNativeTripAction, sendTrip, type NativeTripAction } from "@/lib/nativeBridge";
import { tripMarks, type TripMark } from "@/lib/tripView";

/**
 * The trip sheet when the app draws it (#200). The trips are still found and
 * answered here (useTrips, kept on this phone), so the page sends the trip as
 * it opens and again as each answer changes it, and carries out what is
 * answered on the native sheet, as TripSheet's buttons do.
 */
export default function NativeTrip({
  mark: opened,
  open,
  onClose,
  trips,
}: {
  mark: TripMark | null;
  open: boolean;
  onClose: () => void;
  trips: Trips;
}) {
  const { lang } = useLang();
  // The trip as it is now, by its id: an answer that doesn't settle it brings
  // the same trip back as its next question.
  const live = useMemo(
    () =>
      opened ? (tripMarks(trips.detected, lang).find((m) => m.id === opened.id) ?? null) : null,
    [opened, trips.detected, lang],
  );
  useNativeSheet("trip", open, onClose, onClose, () => ({ mark: live ?? opened }));

  // Each change after it opened goes to the sheet.
  const sent = useRef<TripMark | null>(null);
  useEffect(() => {
    if (!open) {
      sent.current = null;
      return;
    }
    if (sent.current === null) {
      sent.current = live;
      return;
    }
    if (live === sent.current) return;
    sent.current = live;
    sendTrip(live).catch((err) => console.warn("sending the trip failed", err));
  }, [open, live]);

  const answerNow = useRef<(action: NativeTripAction) => void>(() => {});
  useEffect(() => {
    answerNow.current = (action) => {
      switch (action.action) {
        case "accept":
          return trips.accept(action.id);
        case "decline":
          return trips.decline(action.id);
        case "home":
          return trips.setHome(action.city);
        case "return":
          return trips.answerReturn(action.id, action.day);
        case "outbound":
          return trips.answerOutbound(action.id, action.day);
        case "addToCalendar": {
          const mark = live ?? opened;
          if (!mark) return;
          trips.addToCalendar(mark).then(
            (calendar) => sendTrip(live ?? mark, { addedTo: calendar }),
            (err: unknown) =>
              sendTrip(live ?? mark, { error: err instanceof Error ? err.message : String(err) }),
          );
        }
      }
    };
  });
  useEffect(() => {
    if (!open) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let gone = false;
    onNativeTripAction((action) => answerNow.current(action))
      .then((h) => {
        if (gone) void h.remove();
        else handle = h;
      })
      .catch((err) => console.warn("listening to the trip sheet failed", err));
    return () => {
      gone = true;
      void handle?.remove();
    };
  }, [open]);
  return null;
}
