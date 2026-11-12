import { useId, useState } from "react";
import { CalendarRange } from "lucide-react";

import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import { monthName, periodText } from "@/lib/periodText";
import type { Period } from "@/lib/scheduler";

import PlanMonths from "./PlanMonths";

/**
 * "Hvornår" under a genvej about to run (#259): Snarest (from today, every
 * month) unless months are picked, in Planlæg's own month grid grown out of
 * the row. Chosen for this run only: a genvej keeps no months, so it never
 * goes out of date.
 */
export default function WhenRow({
  value,
  onChange,
}: {
  value: Period | null;
  onChange: (period: Period | null) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.planFromCalendar.when;
  const [open, setOpen] = useState(false);
  const anchorId = useId();

  return (
    <>
      <ListGroup className="mt-3">
        <ListRow
          id={anchorId}
          icon={CalendarRange}
          label={words.label}
          value={
            !value
              ? words.soonest
              : // One month by its name alone ("December", not "I december").
                capitalize(
                  value.from === value.to && !value.days
                    ? monthName(value.from, LOCALE[lang], "long")
                    : periodText(value, LOCALE[lang], t),
                )
          }
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
        <div className="px-1 pb-1 [&>section]:mt-0">
          <PlanMonths value={value} onChange={onChange} />
        </div>
      </AnchoredPanel>
    </>
  );
}
