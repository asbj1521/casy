import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { adminStatusQuery } from "@/api/admin";
import { calendarsChanged, calendarStatusQuery, categorizeCalendars } from "@/api/calendars";
import { useAuth } from "@/context/auth";
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
 * (the day's AI calls used up, Anthropic down) is not repeated in a loop. On
 * the admin's own phone, a few event titles per calendar go along while this
 * is tested; nowhere else are titles read for it.
 */
export function useAutoCategorize() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data: connections } = useQuery({
    ...calendarStatusQuery(userId),
    enabled: !!userId,
  });
  const { data: isAdmin, isPending: adminPending } = useQuery({
    ...adminStatusQuery(userId),
    enabled: !!userId && isNativeApp,
  });
  const asked = useRef(new Set<string>());

  useEffect(() => {
    // In the app, wait for whether titles may go along (remembered across
    // reloads, so usually known at once): asked once, a calendar isn't again.
    if (!userId || !connections || (isNativeApp && adminPending)) return;
    const pending = uncategorised(connections).filter((id) => !asked.current.has(id));
    if (pending.length === 0) return;
    for (const id of pending) asked.current.add(id);

    void (async () => {
      let titles: Record<string, string[]> | undefined;
      const phone = isNativeApp && isAdmin ? phoneConnectionId(userId) : null;
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
  }, [connections, isAdmin, adminPending, queryClient, userId]);
}
