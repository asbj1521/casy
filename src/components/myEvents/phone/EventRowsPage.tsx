import { type SuggestedEvent } from "@/api/events";
import EventRows from "@/components/myEvents/phone/EventRows";
import { useT } from "@/i18n/lang";
import { phoneEventList } from "@/lib/myEvents";
import NoEvents from "@/components/myEvents/NoEvents";

/**
 * A phone's My events (#103): one list of compact rows, newest first, past
 * events greyed out at the bottom until they drop off (phoneEventList).
 */
export default function EventRowsPage({ events }: { events: SuggestedEvent[] }) {
  const t = useT();
  const { live, past } = phoneEventList(events);
  if (live.length === 0 && past.length === 0) return <NoEvents />;
  return <EventRows live={live} past={past} pastTitle={t.events.pastClosed} />;
}
