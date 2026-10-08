import type { ReactNode } from "react";

import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";
import type { EventSettings } from "@/lib/eventSearch";
import { formatHeadline } from "@/lib/format";
import type { FoundDate } from "@/lib/scheduler";

/**
 * The flow's last step (#101): the first date, big (the answer card), then
 * the other dates that go into the vote with it, so what the group will
 * swipe through is in plain sight before it is sent, then the month day by
 * day. A tap on a later date, or a day in the chart, starts the vote from
 * there instead.
 */
export default function DatesStep({
  answer,
  workarounds,
  chart,
  search,
  voteDates,
  groupSize,
  onPick,
}: {
  /** The answer card, as the page draws it. */
  answer: ReactNode;
  /** A holiday's ways of fitting (LaterDates), when it doesn't fit cleanly. */
  workarounds: ReactNode;
  /** The month, day by day (DayChart). */
  chart: ReactNode;
  search: EventSettings;
  /** The dates the vote would offer, the answer first; null while there are none to show. */
  voteDates: FoundDate[] | null;
  /** How many people the search covers, for "3 af 4 kan". */
  groupSize: number;
  /** A date picked: its start. */
  onPick: (start: string) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const others = voteDates?.slice(1) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {answer}
      {workarounds}
      {voteDates && others.length === 0 && (
        <p className="px-4 text-xs text-muted-foreground">{t.schedulerFlow.onlyOne}</p>
      )}
      {others.length > 0 && (
        <ListGroup className="mt-0" title={t.schedulerFlow.alsoInVote}>
          {others.map(({ slot, conflicts, absent = [] }) => {
            const { lines, time } = formatHeadline(search, slot, lang, t);
            return (
              <ListRow
                key={slot.start}
                label={lines.join(" ")}
                detail={time}
                value={t.scheduler.countCan(
                  groupSize - conflicts.length - absent.length,
                  groupSize,
                )}
                chevron
                onClick={() => onPick(slot.start)}
              />
            );
          })}
        </ListGroup>
      )}
      {chart}
    </div>
  );
}
