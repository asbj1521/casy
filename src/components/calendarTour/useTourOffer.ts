import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { calendarStatusQuery } from "@/api/calendars";
import { useSignedInUser } from "@/context/auth";
import { useAiContent } from "@/hooks/useAiAllowed";
import { uncategorised } from "@/lib/autoCategorize";
import { rememberTourOffered, wasTourOffered } from "@/lib/calendarTour";
import { isNativeApp } from "@/lib/nativeApp";

/** A moment on the bare month first, so it doesn't land the instant the last thing closed. */
const SETTLE_MS = 700;
/** How long it waits for Casy's guesses, so most cards take one tap, before going without them. */
const GUESSES_MS = 6000;

/**
 * Offers the guided calendar setup once (#221), in the app: when the home page
 * has nothing else to ask (#205, `ready`) and there is a calendar to go through.
 * Once only, whatever is answered: it is always there under Kalendere.
 */
export function useTourOffer({
  ready,
  count,
  onOffer,
}: {
  ready: boolean;
  /** How many calendars it would go through. */
  count: number;
  onOffer: () => void;
}) {
  const userId = useSignedInUser().id;
  const aiSorting = useAiContent();
  const [offered, setOffered] = useState(() => wasTourOffered(userId));
  const wanted = isNativeApp && ready && !offered && count > 0;
  const { data: connections } = useQuery({
    ...calendarStatusQuery(userId),
    enabled: isNativeApp && !offered,
  });
  const known = !!connections;
  const guessing = aiSorting && !!connections && uncategorised(connections).length > 0;

  useEffect(() => {
    if (!wanted || !known) return;
    const id = setTimeout(
      () => {
        rememberTourOffered(userId);
        setOffered(true);
        onOffer();
      },
      guessing ? GUESSES_MS : SETTLE_MS,
    );
    return () => clearTimeout(id);
    // `onOffer` is new on each draw of the page, and must not start the wait over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, known, guessing, userId]);
}
