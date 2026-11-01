import { useMemo, useState } from "react";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { eventsQuery, rankDates } from "@/api/events";
import { groupBusyQuery, groupsQuery, type GroupBusy } from "@/api/groups";
import { useSignedInUser } from "@/context/auth";
import { ANY_TIME_EARLIEST_HOUR, SEARCH_WINDOW } from "@/lib/eventSearch";
import {
  MIN_GROUP_SIZE,
  MIN_HOURS,
  pickPrimeDates,
  primeCandidates,
  type PrimeDate,
  type PrimeGroup,
} from "@/lib/primeDates";
import { APP_TIME_ZONE } from "@/lib/zone";

/**
 * How long a group's busy times and scores are good for here: stars are
 * about the next weeks, so a few hours old is fresh. Kept in memory only:
 * other people's busy times are never remembered across visits.
 */
const FRESH_MS = 3 * 3_600_000;
/** How many of a group's stretches are scored: its best, which are the ones that can win. */
const SCORED = 10;

// Outside the component, so TanStack Query keeps their answers the same while the data is.
const datas = (results: UseQueryResult<GroupBusy>[]) => results.map((r) => r.data);
const scoreMaps = (results: UseQueryResult<Map<number, number>>[]) =>
  results.map((r) => ({ data: r.data, settled: !r.isPending || r.fetchStatus === "idle" }));

/**
 * Tid til hinanden (#171) for the home page: the few stretches coming up
 * when a whole group of yours is free (lib/primeDates), each group's busy
 * times read as Planlæg reads them (usually cached already) and its best
 * stretches scored once (#119's day scores, one call a group). Nothing
 * until `enabled` (the home page has settled), and nothing shown until the
 * scores are in, so the stars don't jump.
 */
export function usePrimeDates(enabled: boolean): PrimeDate[] {
  const userId = useSignedInUser().id;
  const { data: groups } = useQuery({ ...groupsQuery(userId), enabled });
  const { data: events } = useQuery({ ...eventsQuery(userId), enabled });
  const busy = useQueries({
    queries: (groups ?? []).map((g) => ({
      ...groupBusyQuery(userId, g.id, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
      // Only groups that can have stars: four or more, not switched off.
      enabled: enabled && g.primeDates !== false && g.members.length >= MIN_GROUP_SIZE,
      staleTime: FRESH_MS,
    })),
    combine: datas,
  });

  // Today as the home page opened: the stars are for the weeks from tomorrow.
  const [now] = useState(() => Date.now());
  const candidates = useMemo(
    () =>
      (groups ?? []).map((g, i) => {
        const data = busy[i];
        // Switched off for this group by you (#171): no stars, nothing scored.
        if (!data || !events || g.primeDates === false) return [];
        const own = events.filter(
          (e) => e.group.id === g.id && (e.status === "pending" || e.status === "scheduled"),
        );
        const group: PrimeGroup = {
          id: g.id,
          memberIds: g.members.map((m) => m.profileId),
          busy: data.busy,
          connected: data.connected,
          eventDates: own.flatMap((e) => [
            ...(e.currentDate ? [e.currentDate] : []),
            ...e.candidates,
          ]),
          voting: own.some((e) => e.status === "pending"),
        };
        return primeCandidates(group, now, APP_TIME_ZONE);
      }),
    [groups, busy, events, now],
  );

  // A group's best stretches of a day scored by everyone's important events,
  // as the paper pile scores a vote's dates. Weekends are left as they are.
  const scored = candidates.map((list) => list.filter((p) => p.kind === "hours").slice(0, SCORED));
  const scores = useQueries({
    queries: scored.map((list, i) => ({
      queryKey: ["prime-scores", groups?.[i]?.id, list.map((p) => p.start).join(",")],
      queryFn: async () => {
        const { scores, counted } = await rankDates({
          groupId: groups![i].id,
          settings: {
            kind: "single",
            durationMinutes: MIN_HOURS * 60,
            startHour: ANY_TIME_EARLIEST_HOUR,
          },
          profile: null,
          dates: list.map((p) => ({
            start: new Date(p.start).toISOString(),
            end: new Date(p.end).toISOString(),
          })),
        });
        // With nobody's facts shared, the scores say nothing.
        return new Map(counted > 0 ? list.map((p, j) => [p.start, scores[j]] as const) : []);
      },
      enabled: enabled && list.length > 0,
      staleTime: FRESH_MS,
      retry: false,
    })),
    combine: scoreMaps,
  });

  const allSettled = scores.every((s) => s.settled);
  return useMemo(() => {
    if (!allSettled) return [];
    const byGroup = new Map(
      scores.flatMap((s, i) => (s.data && groups?.[i] ? [[groups[i].id, s.data] as const] : [])),
    );
    return pickPrimeDates(candidates, byGroup);
  }, [allSettled, scores, groups, candidates]);
}
