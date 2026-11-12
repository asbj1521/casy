import { useId, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { TODAY } from "@/hooks/useDateSearch";
import type { Planning } from "@/hooks/usePlanning";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { capitalize, formatDate } from "@/lib/format";
import { firstDateByCount, MIN_COUNT, requiredCount } from "@/lib/widen";
import { APP_TIME_ZONE } from "@/lib/zone";

/**
 * "Hvor mange skal kunne" (#259), up front in the Planlæg sheet under the
 * months: a number, not people picked one by one, so nobody is quietly left
 * out. Its picker grows out of the row (#175) with every count from everyone
 * Med down to two, each beside the first date it finds in the months picked
 * (#255, firstDateByCount): what one person fewer buys is seen before it is
 * picked, and a count with no date in those months shows what the months can
 * hold. Worked out only while the picker is open. Meetings only, and only
 * with three or more Med; the same choice as Flere detaljer's Deltagere.
 */
export default function HowManyRow({ planning }: { planning: Planning }) {
  const t = useT();
  const { lang } = useLang();
  const words = t.planFromCalendar.howMany;
  const { activeGroup, participants, sched, peopleChoice, updatePeople } = planning;
  const [open, setOpen] = useState(false);
  const anchorId = useId();

  const members = useMemo(
    () => activeGroup?.members.map((m) => m.profileId) ?? [],
    [activeGroup?.members],
  );
  const of = requiredCount(members, peopleChoice);
  const count = peopleChoice.atLeast === null ? of : Math.min(peopleChoice.atLeast, of);

  const options = useMemo(
    () =>
      open && participants
        ? firstDateByCount({
            participants,
            settings: sched,
            members,
            choice: peopleChoice,
            today: TODAY,
            limit: SEARCH_WINDOW,
            timeZone: APP_TIME_ZONE,
          })
        : [],
    [open, participants, sched, members, peopleChoice],
  );

  if (!activeGroup || activeGroup.isExample || sched.multiDay || of <= MIN_COUNT) return null;
  const countText = (n: number) => (n === of ? words.all(of) : words.some(n, of));

  return (
    <>
      <ListGroup className="mt-4">
        <ListRow
          id={anchorId}
          icon={Users}
          label={words.label}
          value={countText(count)}
          chevron
          onClick={() => setOpen(true)}
        />
      </ListGroup>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorId={anchorId}
        label={words.label}
      >
        <ListGroup className="mt-0" footnote={words.footnote}>
          {options.map((option) => (
            <ListPickRow
              key={option.count}
              type="radio"
              name="how-many"
              checked={option.count === count}
              onChange={() => {
                updatePeople({
                  ...peopleChoice,
                  atLeast: option.count === option.of ? null : option.count,
                });
                setOpen(false);
              }}
              label={countText(option.count)}
              // Under the count: the tick has the row's end.
              detail={
                option.first ? capitalize(formatDate(option.first.slot.start, lang)) : words.none
              }
            />
          ))}
        </ListGroup>
      </AnchoredPanel>
    </>
  );
}
