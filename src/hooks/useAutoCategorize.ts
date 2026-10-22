import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { calendarsChanged, calendarStatusQuery, categorizeCalendars } from "@/api/calendars";
import { useAuth } from "@/context/auth";
import { useAiContent } from "@/hooks/useAiAllowed";
import { phoneSourceIds, sampleTitles, uncategorised } from "@/lib/autoCategorize";
import { isNativeApp } from "@/lib/nativeApp";
import { phoneConnectionId, readPhoneEventDetails } from "@/lib/phoneCalendar";

/** How far around today the admin's phone looks for sample titles. */
const TITLES_BEHIND_MS = 60 * 86_400_000;
const TITLES_AHEAD_MS = 120 * 86_400_000;

/**
 * Sorts calendars nobody has given a category yet, with AI, in the
 * background (#118): a calendar connected (or new on the phone) gets work,
 * school, personal or other without anyone asking, and its owner can change
 * it as before. Never a calendar whose category was picked or cleared by
 * hand: the server only fills untouched ones, and checks again as it writes.
 *
 * Each calendar is asked about at most once per page load, so a failing call
 * (the day's AI calls used up, Anthropic down) is not repeated in a loop. A
 * calendar's name goes to the AI, so this waits for the person's yes to the AI
 * using their calendar (#120); in the app, a few event titles per calendar go
 * along too.
 */
export function useAutoCategorize() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data: connections } = useQuery({
    ...calendarStatusQuery(userId),
    enabled: !!userId,
  });
  // Only for those the AI is on for (#111) and who said yes (#120); the server
  // refuses the rest anyway.
  const allowed = useAiContent();
  const asked = useRef(new Set<string>());

  useEffect(() => {
    if (!userId || !allowed || !connections) return;
    const pending = uncategorised(connections).filter((id) => !asked.current.has(id));
    if (pending.length === 0) return;
    for (const id of pending) asked.current.add(id);

    void (async () => {
      let titles: Record<string, string[]> | undefined;
      const phone = isNativeApp ? phoneConnectionId(userId) : null;
      if (phone) {
        try {
          const now = Date.now();
          const events = await readPhoneEventDetails(now - TITLES_BEHIND_MS, now + TITLES_AHEAD_MS);
          titles = sampleTitles(events, phoneSourceIds(connections, phone), new Set(pending), now);
        } catch (err) {
          // Names alone still sort them.
          console.warn("reading sample titles failed", err);
        }
      }
      const categorized = await categorizeCalendars(titles);
      if (categorized.length > 0) await calendarsChanged(queryClient);
    })().catch((err) => console.warn("sorting calendars failed", err));
  }, [connections, allowed, queryClient, userId]);
}
