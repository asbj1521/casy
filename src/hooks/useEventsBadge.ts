import { useQuery } from "@tanstack/react-query";

import { eventsQuery, needsYourAnswer } from "@/api/events";
import { useAuth } from "@/context/auth";

/**
 * The number on My events, in the header and the tab bar alike: the votes
 * with dates still waiting for your answer.
 */
export function useEventsBadge(): number | undefined {
  const { user } = useAuth();
  const { data: events } = useQuery({ ...eventsQuery(user?.id ?? ""), enabled: !!user });
  return events?.filter((e) => needsYourAnswer(e)).length;
}
