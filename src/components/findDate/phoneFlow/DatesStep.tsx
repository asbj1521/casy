import type { ReactNode } from "react";
import { CalendarRange, ChevronDown, Hourglass } from "lucide-react";

import Dropdown from "@/components/Dropdown";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";
import type { EventSettings } from "@/lib/eventSearch";
import { formatHeadline } from "@/lib/format";
import {
  ANSWER_DAY_VALUES,
  DATE_COUNT_VALUES,
  type EventExtras,
  type FoundDate,
} from "@/lib/scheduler";

import FieldRow, { ROW_PICK } from "./FieldRow";

/**
 * The flow's last step (#101): the first date, big (the answer card), how
 * the vote runs (how many dates, and how long everyone has to answer), then
 * the other dates that go into the vote with it, so what the group will
 * swipe through is in plain sight before it is sent, then the month day by
 * day. The vote's settings live here rather than among the details: beside
 * the dates, they explain themselves, and fewer or more dates show at once.
 * A tap on a later date, or a day in the chart, starts the vote from there.
 */
export default function DatesStep({
  answer,
  workarounds,
  extras,
  onExtras,
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
  /** How many dates the vote offers, and how long everyone has to answer. */
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
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
  const words = t.settingsPanel.vote;
  const chevron = <ChevronDown className="h-4 w-4 shrink-0" />;

  return (
    <div className="flex flex-col gap-4">
      {answer}
      {workarounds}
      <ListGroup className="mt-0" title={t.settingsPanel.tabs.vote}>
        <FieldRow icon={CalendarRange} label={words.dates} labelled={false}>
          <Dropdown
            value={extras.dateCount}
            options={DATE_COUNT_VALUES.map((n) => ({ label: words.upTo(n), value: n }))}
            onChange={(dateCount) => onExtras({ dateCount })}
            suffix={chevron}
            triggerClassName={ROW_PICK}
          />
        </FieldRow>
        <FieldRow icon={Hourglass} label={words.deadline} labelled={false}>
          <Dropdown
            value={extras.answerDays}
            options={ANSWER_DAY_VALUES.map((d) => ({ label: t.common.days(d), value: d }))}
            onChange={(answerDays) => onExtras({ answerDays })}
            suffix={chevron}
            triggerClassName={ROW_PICK}
          />
        </FieldRow>
      </ListGroup>
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
