import { ChevronRight, MapPin } from "lucide-react";

import type { SuggestedEvent } from "@/api/events";
import { useIsDark } from "@/hooks/useIsDark";
import { eventTitle } from "@/i18n/eventTitle";
import { useT } from "@/i18n/lang";
import { formatTime } from "@/lib/format";
import { CASY_RGB } from "@/lib/homeVotes";
import { shade } from "@/lib/tint";

/**
 * One of Casy's own events in a day's list on the home page (#172), drawn
 * like the day's other rows (DayRow) in Casy's orange: an agreed event
 * ("Aftale"), which opens Aftaler, or a vote's date waiting for your answer
 * ("Afstemning"), which starts answering it.
 */
export default function CasyDayRow({
  event,
  start,
  end,
  vote,
  onOpen,
}: {
  event: SuggestedEvent;
  start: string;
  end: string;
  /** A vote's date still to answer, rather than an agreed event. */
  vote: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const dark = useIsDark();
  const rgb = CASY_RGB;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 py-3 text-left text-sm"
      >
        <span
          className="mt-0.5 h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: `rgb(${rgb})` }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{eventTitle(event.title, t)}</p>
          <p className="text-muted-foreground">
            {t.planFromCalendar.fromTo(formatTime(start), formatTime(end))} · {event.group.name}
          </p>
          {event.place && (
            <p className="mt-0.5 flex items-start gap-1 text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{event.place}</span>
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: `rgba(${rgb}, 0.16)`,
            color: `rgb(${dark ? shade(rgb, true) : rgb})`,
          }}
        >
          {vote ? t.homeVote.votePill : t.homeVote.agreedPill}
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      </button>
    </li>
  );
}
