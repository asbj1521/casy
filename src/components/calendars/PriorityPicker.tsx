import { useId, useState } from "react";

import PickerButton from "@/components/calendars/PickerButton";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { ListGroup, ListPickRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import type { OverviewCalendar } from "@/lib/calendarOverview";
import type { CalendarPriority } from "@/types";

const PRIORITIES: CalendarPriority[] = ["skip", "normal", "never"];

/** How much a calendar matters on a phone, drawn as its category is (CategoryPicker). */
export default function PriorityPicker({
  calendar,
  anchorId,
  disabled,
  onChange,
}: {
  calendar: OverviewCalendar;
  /** What the choices grow out of: the calendar's whole row, for its width. */
  anchorId: string;
  disabled: boolean;
  onChange: (priority: CalendarPriority) => void;
}) {
  const words = useT().calendarView;
  const group = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PickerButton
        label={words.priorityFor(calendar.name)}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{words.priorities[calendar.priority]}</span>
      </PickerButton>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorId={anchorId}
        label={words.priorityFor(calendar.name)}
      >
        <ListGroup className="mt-0">
          {PRIORITIES.map((priority) => (
            <ListPickRow
              key={priority}
              type="radio"
              name={group}
              checked={calendar.priority === priority}
              onChange={() => {
                onChange(priority);
                setOpen(false);
              }}
              label={words.priorities[priority]}
            />
          ))}
        </ListGroup>
      </AnchoredPanel>
    </>
  );
}
