import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey } from "@/api/events";
import { groupsQueryKey, invitationsQueryKey, pulseQuery, type Group } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { membershipKey } from "@/lib/groups";
import { PUSH_HIDDEN_GRACE_MS, PUSH_SIGNAL_DEBOUNCE_MS, pollDelay } from "@/lib/livePace";
import { watchPulsePush } from "@/lib/livePush";

/**
 * Keeps every open page up to date with what other people do: watches the
 * pulse (api/groups.ts), and when it moves, fetches your groups, invitations
 * and events again. Only what a page shows is fetched now; the rest is
 * marked out of date and fetched when next needed.
 *
 * When to ask the pulse: while the tab is visible it is subscribed to
 * Realtime (lib/livePush.ts), which says when something changed, and asks on
 * its own only every few minutes. Without Realtime (still connecting, or it
 * failed) it asks often right after something happened and less and less
 * while nothing does (lib/livePace.ts): the pulse moving, any of your own
 * changes, and coming back to the tab all count as something happening.
 *
 * Group calendars are big and only change with the hourly sync, so they are
 * fetched again right away only when someone joined or left a group (until
 * then a new member's busy times are missing from the search).
 */
export function useLiveUpdates() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  // Set by the first answer, which always counts as activity (see below).
  const lastActive = useRef(0);
  const pacedPulse = useRef<string | undefined>(undefined);
  const pushLive = useRef(false);

  const { data: pulse } = useQuery({
    ...pulseQuery(userId),
    enabled: !!user,
    // Worked out after every answer, so a pulse that just moved counts as
    // activity before the next wait is chosen.
    refetchInterval: (query) => {
      if (query.state.data !== pacedPulse.current) {
        pacedPulse.current = query.state.data;
        lastActive.current = Date.now();
      }
      return pollDelay(Date.now() - lastActive.current, pushLive.current);
    },
  });
  const lastSeen = useRef<string | undefined>(undefined);

  // Your own change: others are likely to answer it soon, so ask now and
  // then often again. Asking now also restarts a long wait already under way.
  useEffect(() => {
    if (!userId) return;
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      lastActive.current = Date.now();
      void queryClient.invalidateQueries({ queryKey: pulseQuery(userId).queryKey });
    });
  }, [queryClient, userId]);

  // Realtime while the tab is visible, and for a minute after it is hidden.
  // Back in the tab, React Query asks the pulse at once by itself (it is
  // always stale), and the waits after that start short again.
  useEffect(() => {
    if (!userId) return;
    const askPulse = () =>
      void queryClient.invalidateQueries({ queryKey: pulseQuery(userId).queryKey });

    let stopPush: (() => void) | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let signalTimer: ReturnType<typeof setTimeout> | undefined;

    const setLive = (live: boolean) => {
      if (live === pushLive.current) return;
      pushLive.current = live;
      // Either way the wait under way is the wrong one now, and on (re)joining
      // anything sent while not subscribed was missed: ask once.
      if (document.visibilityState === "visible") askPulse();
    };
    const startPush = () => {
      stopPush ??= watchPulsePush(userId, {
        onSignal: () => {
          // A hidden tab asks when it comes back; no need to ask for it now.
          if (document.visibilityState !== "visible") return;
          lastActive.current = Date.now();
          clearTimeout(signalTimer);
          signalTimer = setTimeout(askPulse, PUSH_SIGNAL_DEBOUNCE_MS);
        },
        onLive: setLive,
      });
    };
    const stopPushNow = () => {
      stopPush?.();
      stopPush = null;
      pushLive.current = false;
    };

    const onVisibility = () => {
      clearTimeout(hiddenTimer);
      if (document.visibilityState === "visible") {
        lastActive.current = Date.now();
        startPush();
      } else {
        hiddenTimer = setTimeout(stopPushNow, PUSH_HIDDEN_GRACE_MS);
      }
    };

    if (document.visibilityState === "visible") startPush();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(hiddenTimer);
      clearTimeout(signalTimer);
      stopPushNow();
    };
  }, [queryClient, userId]);

  useEffect(() => {
    if (!pulse) return;
    const changed = lastSeen.current !== undefined && lastSeen.current !== pulse;
    lastSeen.current = pulse;
    if (!changed) return;

    const before = membershipKey(queryClient.getQueryData<Group[]>(groupsQueryKey(userId)));
    void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
    void queryClient.invalidateQueries({ queryKey: invitationsQueryKey(userId) });
    void queryClient.invalidateQueries({ queryKey: ["group-busy", userId], refetchType: "none" });
    void queryClient.invalidateQueries({ queryKey: groupsQueryKey(userId) }).then(() => {
      const after = membershipKey(queryClient.getQueryData<Group[]>(groupsQueryKey(userId)));
      if (after !== before) {
        void queryClient.invalidateQueries({ queryKey: ["group-busy", userId] });
      }
    });
  }, [pulse, queryClient, userId]);
}
