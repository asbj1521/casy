import { useMutation, useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey, type SuggestedEvent } from "@/api/events";
import { useSignedInUser } from "@/context/auth";

/**
 * One change to a suggested event: accept, decline, cancel or leave. Each
 * answers with the fresh list of your events, which goes straight into the
 * cache. A failure refetches the list instead: the usual cause is someone
 * else answering first, and the fresh list shows what changed.
 */
export function useEventChange(change: () => Promise<{ events: SuggestedEvent[] }>) {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (data) => queryClient.setQueryData(eventsQueryKey(userId), data.events),
    onError: () => void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) }),
  });
}
