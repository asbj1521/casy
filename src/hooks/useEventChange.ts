import { useMutation, useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey, type SuggestedEvent } from "@/api/events";
import { useSignedInUser } from "@/context/auth";

/**
 * One change to a suggested event: accept, decline, cancel, leave, or choose
 * a vote's date (which takes the date as `v`). Each
 * answers with the fresh list of your events, which goes straight into the
 * cache. A failure refetches the list instead: the usual cause is someone
 * else answering first, and the fresh list shows what changed.
 */
export function useEventChange<V = void>(change: (v: V) => Promise<{ events: SuggestedEvent[] }>) {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (data) => queryClient.setQueryData(eventsQueryKey(userId), data.events),
    onError: () => void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) }),
  });
}
