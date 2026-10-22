import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { rankDates } from "@/api/events";
import type { EventImpact } from "@/api/eventProfile";
import type { EventSettings } from "@/lib/eventSearch";

/** How long a screen waits for the scores before it goes on without them. */
export const SCORE_WAIT_MS = 1_500;

/**
 * How well each date of `dates` suits a group by everyone's important events
 * (#119): the server combines what the members' phones shared and answers one
 * score per date, never whose events cost what. For the paper pile, which
 * ranks a vote's dates before listing them. `scores` is by the start of a
 * date's slot, undefined until they come; `settled` says when to stop
 * waiting: they came, the call failed, it isn't asked for (`enabled` false), or
 * SCORE_WAIT_MS passed, since scores are never worth a long wait.
 */
export function useDateScores({
  groupId,
  settings,
  profile,
  dates,
  enabled,
}: {
  groupId: string | null;
  settings: EventSettings;
  profile: EventImpact | null;
  dates: { slot: { start: string; end: string } }[] | null;
  enabled: boolean;
}) {
  const asked = enabled && !!groupId && !!dates && dates.length > 0;
  const query = useQuery({
    queryKey: [
      "date-scores",
      groupId,
      JSON.stringify(settings),
      JSON.stringify(profile),
      dates?.map((d) => d.slot.start).join(","),
    ],
    queryFn: () =>
      rankDates({
        groupId: groupId!,
        settings,
        profile,
        dates: dates!.map((d) => ({ start: d.slot.start, end: d.slot.end })),
      }),
    enabled: asked,
    staleTime: 60_000,
    retry: false,
  });

  const [timedOut, setTimedOut] = useState(false);
  const waiting = asked && query.isPending;
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setTimedOut(true), SCORE_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [waiting]);

  const scores = useMemo(
    () =>
      query.data && dates
        ? new Map(dates.map((d, i) => [d.slot.start, query.data.scores[i]] as const))
        : undefined,
    [query.data, dates],
  );
  // `counted`: how many members had shared anything; with none, a score says nothing.
  return { scores, counted: query.data?.counted ?? 0, settled: !waiting || timedOut };
}
