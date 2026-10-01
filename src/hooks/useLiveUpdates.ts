import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey } from "@/api/events";
import { groupsQueryKey, invitationsQueryKey, pulseQuery, type Group } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { membershipKey } from "@/lib/groups";

/**
 * Keeps every open page up to date with what other people do: watches the
 * pulse (api/groups.ts), and when it moves, fetches your groups, invitations
 * and events again. Only what a page shows is fetched now; the rest is
 * marked out of date and fetched when next needed.
 *
 * Group calendars are big and only change with the hourly sync, so they are
 * fetched again right away only when someone joined or left a group (until
 * then a new member's busy times are missing from the search).
 */
export function useLiveUpdates() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const { data: pulse } = useQuery({ ...pulseQuery(userId), enabled: !!user });
  const lastSeen = useRef<string | undefined>(undefined);

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
