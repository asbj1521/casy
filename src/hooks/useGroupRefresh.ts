import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { groupBusyQuery, refreshGroupCalendars, type GroupBusy } from "@/api/groups";
import { SEARCH_WINDOW } from "@/lib/eventSearch";

/**
 * Fresh busy times for the groups someone is planning with (#85). Calendars
 * sync hourly, so a friend's new appointment can be up to an hour from
 * reaching Casy. While someone plans (the scheduler) or looks at events
 * waiting for answers (My events), the group's members' calendars are synced
 * in the background instead (the groups function's `refresh`), at most once a
 * minute per group, and the group's busy times fetched again if anything was
 * synced. Nothing waits for it: "Suggest this date" only waits a moment for
 * one already running (see FindDate).
 */

/** A group refreshed this recently isn't asked again; the server keeps the same minimum per account. */
const REFRESH_EVERY_MS = 60_000;
/** When some syncs outlast the server's deadline, look again this much later. */
const LATE_SYNC_RECHECK_MS = 20_000;

/** The group's busy times before and after a refresh; `after` only if anything was synced. */
export interface RefreshOutcome {
  before: GroupBusy | undefined;
  after: GroupBusy | undefined;
}

interface Started {
  at: number;
  done: Promise<RefreshOutcome>;
  running: boolean;
}

/** Started refreshes, per account and group, for the life of the page. */
const started = new Map<string, Started>();

export interface GroupRefresh {
  /** Start a refresh unless one started within the last minute: the new one, or null. */
  start: (groupId: string) => Promise<RefreshOutcome> | null;
  /** The refresh running for the group right now, if there is one. */
  running: (groupId: string) => Promise<RefreshOutcome> | null;
}

export function useGroupRefresh(userId: string): GroupRefresh {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const keyOf = (groupId: string) => `${userId}:${groupId}`;

    function start(groupId: string): Promise<RefreshOutcome> | null {
      if (!userId) return null;
      const key = keyOf(groupId);
      const known = started.get(key);
      if (known && (known.running || Date.now() - known.at < REFRESH_EVERY_MS)) return null;

      const busy = groupBusyQuery(userId, groupId, SEARCH_WINDOW.start, SEARCH_WINDOW.end);
      const before = queryClient.getQueryData<GroupBusy>(busy.queryKey);
      const entry: Started = {
        at: Date.now(),
        running: true,
        done: Promise.resolve({ before, after: undefined }),
      };
      entry.done = (async (): Promise<RefreshOutcome> => {
        try {
          const { complete, synced } = await refreshGroupCalendars(
            groupId,
            REFRESH_EVERY_MS / 1000,
          );
          if (!synced) return { before, after: undefined };
          // Your own calendar may be among those synced: the events badge
          // reads it (useEventsBadge).
          void queryClient.invalidateQueries({ queryKey: ["calendar-busy", userId] });
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
          // are still there, and everything goes on with them, as before #85.
          return { before, after: undefined };
        } finally {
          entry.running = false;
        }
      })();
      started.set(key, entry);
      return entry.done;
    }

    function running(groupId: string): Promise<RefreshOutcome> | null {
      const known = started.get(keyOf(groupId));
      return known?.running ? known.done : null;
    }

    return { start, running };
  }, [queryClient, userId]);
}
