import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { eventsQuery } from "@/api/events";
import DateDeck from "@/components/swipe/DateDeck";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { isVote } from "@/lib/vote";

/**
 * Swiping through a vote's dates on a phone (#74), the whole screen given to
 * the cards: over the tab bar, as a screen of its own in an app would be.
 * A computer answers the same cards beside the list instead (VoteDetails),
 * so it is sent there; an event that isn't a vote (or is gone) goes back to
 * My events.
 */
export default function SwipeDates() {
  const userId = useSignedInUser().id;
  const { eventId } = useParams();
  const phone = usePhoneLayout();
  const { data: events, isPending } = useQuery(eventsQuery(userId));

  // The page under the cards mustn't scroll along with a drag.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  if (!phone) return <Navigate to={`/events/${eventId}`} replace />;
  const event = events?.find((e) => e.id === eventId);
  if (!isPending && (!event || !isVote(event))) return <Navigate to="/events" replace />;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {event && isVote(event) ? (
        <DateDeck event={event} variant="screen" />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
