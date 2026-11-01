import { queryOptions } from "@tanstack/react-query";

import { currentMessages } from "@/i18n/current";
import type { PrimeStretch } from "@/lib/primeDates";
import { callFunction } from "@/lib/supabaseFunctions";

/** One idea for a time a whole group is free (#171): its name in Planlæg, and why it fits. */
export interface PrimeIdea {
  title: string;
  why: string;
}

/**
 * Two or three ideas for a stretch a group is free (the prime-ideas
 * function), asked once per stretch and language and kept for the visit:
 * the same stretch opened again costs nothing. Only for people the AI
 * features are on for; a failure just leaves the sheet without ideas.
 */
export function primeIdeasQuery(stretch: PrimeStretch, lang: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["prime-ideas", stretch, lang],
    queryFn: async (): Promise<PrimeIdea[]> => {
      const { ideas } = await callFunction<{ ideas: PrimeIdea[] }>("prime-ideas", {
        body: { stretch },
        errorMessage: currentMessages().prime.ideasFailed,
      });
      return ideas;
    },
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
