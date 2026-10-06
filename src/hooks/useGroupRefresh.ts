import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { groupBusyQuery, refreshGroupCalendars, type GroupBusy } from "@/api/groups";
import { SEARCH_WINDOW } from "@/lib/eventSearch";

/**
 * Fresh busy times for the group being planned for (#85). Calendars sync
 * hourly, so a friend's new appointment can be up to an hour from reaching
 * Casy; while someone plans for a group, its members' calendars are synced
 * now instead (the groups function's `refresh`), and the group's busy times
 * fetched again if anything was synced.
 *
 * One refresh per group every REFRESH_EVERY_MS, shared: the background one
 * started when someone begins planning, and the one "Suggest this date"
 * waits for, are the same request whenever they overlap. The server has its
 * own 10-minute rule per account, so this only saves round trips.
 */

/** A group refreshed this recently isn't asked again. */
const REFRESH_EVERY_MS = 10 * 60_000;
/** When some syncs outlast the server's deadline, look again this much later. */
const LATE_SYNC_RECHECK_MS = 20_000;

/** The group's busy times before and after a refresh; `after` only if anything was synced. */
export interface RefreshOutcome {
  before: GroupBusy | undefined;
  after: GroupBusy | undefined;
}

/** Started refreshes, per account and group, for the life of the page. */
const started = new Map<string, { at: number; done: Promise<RefreshOutcome> }>();

export function useGroupRefresh(userId: string) {
  const queryClient = useQueryClient();

  return useCallback(
    (groupId: string): Promise<RefreshOutcome> => {
      const key = `${userId}:${groupId}`;
      const known = started.get(key);
      if (known && Date.now() - known.at < REFRESH_EVERY_MS) return known.done;

      const busy = groupBusyQuery(userId, groupId, SEARCH_WINDOW.start, SEARCH_WINDOW.end);
      const before = queryClient.getQueryData<GroupBusy>(busy.queryKey);
      const done = (async (): Promise<RefreshOutcome> => {
        try {
          const { complete, synced } = await refreshGroupCalendars(groupId);
          if (!synced) return { before, after: undefined };
          const after = await queryClient.fetchQuery({ ...busy, staleTime: 0 });
          // Slow syncs (iCloud, usually) finish on the server after its
          // answer: fetch once more when they should be done.
          if (!complete) {
            setTimeout(
              () => void queryClient.invalidateQueries({ queryKey: busy.queryKey }),
              LATE_SYNC_RECHECK_MS,
            );
          }
          return { before, after };
        } catch {
          // Offline, or the function failed: the hourly sync's busy times
          // are still there, and planning goes on with them, as before #85.
          started.delete(key);
          return { before, after: undefined };
        }
      })();
      started.set(key, { at: Date.now(), done });
      return done;
    },
    [queryClient, userId],
  );
}
