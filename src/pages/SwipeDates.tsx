import { Navigate, useParams } from "react-router-dom";

import { usePhoneLayout } from "@/hooks/usePhoneLayout";

/**
 * The old swipe screen's address (#74), still in push notifications and
 * links sent before #172: a phone answers a vote over the home page's month
 * now (`/?vote=<id>`, HomeVote), and a computer answers it beside the list
 * in the open event (VoteDetails).
 */
export default function SwipeDates() {
  const { eventId } = useParams();
  const phone = usePhoneLayout();
  return <Navigate to={phone ? `/?vote=${eventId}` : `/events/${eventId}`} replace />;
}
