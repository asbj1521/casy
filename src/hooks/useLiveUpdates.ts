import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey } from "@/api/events";
import { groupsQueryKey, invitationsQueryKey, pulseQuery, type Group } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { membershipKey } from "@/lib/groups";
import { pollDelay } from "@/lib/livePace";

/**
 * Keeps every open page up to date with what other people do: watches the
 * pulse (api/groups.ts), and when it moves, fetches your groups, invitations
 * and events again. Only what a page shows is fetched now; the rest is
 * marked out of date and fetched when next needed.
 *
 * The pulse is asked often right after something happened and less and less
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
      return pollDelay(Date.now() - lastActive.current);
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

  // Back in the tab: React Query asks the pulse at once by itself (it is
  // always stale), and the waits after that start short again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") lastActive.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

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
