import { useCallback, useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";

import { profileEvent, type EventImpact, type EventToProfile } from "@/api/eventProfile";
import { useAuth } from "@/context/auth";
import { useAiAllowed } from "@/hooks/useAiAllowed";

/** How long the name, place and note must rest before they are asked about. */
const SETTLE_MS = 2000;
/** How long sending waits for a profile still on its way, at most. */
const PROFILE_WAIT_MS = 2000;

/**
 * One profile per exact input, kept for the visit: the same event is never
 * asked about twice. A screen that shows the profile (the warnings, #114)
 * reads it with useQuery and this, enabled only to read the cache.
 */
export function eventProfileQuery(userId: string, input: EventToProfile) {
  return queryOptions({
    queryKey: ["event-profile", userId, input],
    queryFn: () => profileEvent(input),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    // Asked in the background; sending goes without one rather than retry.
    retry: false,
  });
}

/**
 * The profile of the event being set up on the scheduling page (#113): what
 * it is likely to cause for the people going. Asked in the background once
 * the name, place, note and timing have rested a moment (`input` null: not
 * a real event yet, such as an example group), only for people the AI is
 * on for. `forSend` hands sending the profile, waiting at most
 * PROFILE_WAIT_MS for one still on its way; undefined then, and the event
 * goes without one. A profile is never worth holding the button.
 *
 * Nothing here is component state: the answer goes straight into the query
 * cache, so asking never redraws the scheduling page (whose wheels recentre
 * when redrawn mid-turn).
 */
export function useEventProfile(input: EventToProfile | null) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const aiOn = useAiAllowed();
  const queryClient = useQueryClient();
  // Compared as text, so a new object with the same contents changes nothing.
  const key = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!aiOn || !userId || !key) return;
    // Typing in between restarts the wait: only what rested is asked about.
    const timer = setTimeout(() => {
      queryClient
        .prefetchQuery(eventProfileQuery(userId, JSON.parse(key) as EventToProfile))
        .catch(() => undefined);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [aiOn, key, queryClient, userId]);

  const forSend = useCallback(async (): Promise<EventImpact | undefined> => {
    if (!aiOn || !userId || !key) return undefined;
    const query = eventProfileQuery(userId, JSON.parse(key) as EventToProfile);
    try {
      // The one already asked for (or on its way) if there is one, else asked now.
      return await Promise.race([
        queryClient.fetchQuery(query),
        new Promise<undefined>((done) => setTimeout(() => done(undefined), PROFILE_WAIT_MS)),
      ]);
    } catch (err) {
      console.warn("profiling the event failed", err);
      return undefined;
    }
  }, [aiOn, key, queryClient, userId]);

  return { forSend };
}
