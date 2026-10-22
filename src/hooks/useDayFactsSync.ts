import { useEffect, useRef } from "react";

import { pushDayFacts } from "@/api/dayFacts";
import { useAuth } from "@/context/auth";
import { useLabelledEventsState } from "@/hooks/useEventLabels";
import { dayFactsOf } from "@/lib/dayFacts";

/** How long the facts rest before they are sent: labels arrive in batches. */
const SETTLE_MS = 3_000;

/**
 * Keeps the server's copy of this phone's important events (#119) current,
 * mounted once in App.tsx: when the facts change (labels arrive, the calendar
 * moves, a correction is made) they are sent once they have rested a moment,
 * and again when the app is opened. Only in the iPhone app, for those who said
 * yes to the AI using their calendar (useLabelledEventsState is empty
 * otherwise). Waits for the labels to be read, so an empty list is a real
 * one and never clears what is stored while the app is still loading.
 */
export function useDayFactsSync() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { ready, events } = useLabelledEventsState();
  // What the server holds from this launch, so an unchanged list isn't sent again.
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !ready) return;
    const facts = dayFactsOf(events, Date.now());
    const json = JSON.stringify(facts);
    if (json === sent.current) return;
    const timer = setTimeout(() => {
      pushDayFacts(facts)
        .then(() => {
          sent.current = json;
        })
        .catch((err) => console.warn("sharing important events failed", err));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [userId, ready, events]);
}
