import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { eventsQueryKey } from "@/api/events";
import { useSignedInUser } from "@/context/auth";
import { allAnswered, leader, type VoteEvent } from "@/lib/vote";

/** How often, and how many times, to ask again while a vote is being decided. */
const EVERY_MS = 1500;
const TIMES = 6;

/**
 * A vote everyone has answered, with a date nobody declined, is decided by
 * the database the moment the last answer arrives (#74). If this page still
 * shows it waiting, its copy is older than that: it asks for the events
 * again, a few times in quick succession, until the decided date arrives,
 * rather than leaving "the date is being found" up until a reload.
 */
export function useDecidingRefresh(event: VoteEvent): void {
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const deciding = event.status === "pending" && allAnswered(event) && leader(event) !== null;
  useEffect(() => {
    if (!deciding) return;
    let asked = 0;
    const id = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
      if (++asked >= TIMES) clearInterval(id);
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [deciding, queryClient, userId]);
}
