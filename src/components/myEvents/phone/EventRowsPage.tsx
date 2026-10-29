import { type SuggestedEvent } from "@/api/events";
import NoEvents from "@/components/myEvents/NoEvents";
import EventRows from "@/components/myEvents/phone/EventRows";
import { phoneEventGroups } from "@/lib/myEvents";

/**
 * A phone's Aftaler (#103, #177): the three groups of rows, or the way to
 * plan something when there is nothing yet.
 */
export default function EventRowsPage({
  events,
  onAnswer,
  onOpen,
}: {
  events: SuggestedEvent[];
  onAnswer: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const groups = phoneEventGroups(events);
  if (groups.answer.length + groups.coming.length + groups.past.length === 0) return <NoEvents />;
  return <EventRows {...groups} onAnswer={onAnswer} onOpen={onOpen} />;
}
