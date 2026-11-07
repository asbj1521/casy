import { ChevronDown } from "lucide-react";

import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { ListGroup, ListPickRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import type { DatePriority } from "@/lib/scheduler";

const CHOICES: DatePriority[] = ["hassle", "soon"];

/** What the dates are ranked by (#234), growing out of the row that opened it. */
export function DatePriorityPicker({
  open,
  onClose,
  anchorId,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  anchorId: string;
  value: DatePriority;
  onPick: (priority: DatePriority) => void;
}) {
  const words = useT().planFromCalendar.priority;
  return (
    <AnchoredPanel open={open} onClose={onClose} anchorId={anchorId} label={words.label}>
      <ListGroup className="mt-0">
        {CHOICES.map((choice) => (
          <ListPickRow
            key={choice}
            type="radio"
            name="date-priority"
            checked={value === choice}
            onChange={() => {
              onPick(choice);
              onClose();
            }}
            label={words[choice]}
          />
        ))}
      </ListGroup>
    </AnchoredPanel>
  );
}

/** The same choice as a row over the list of dates, which re-ranks as it changes. */
export function DatePriorityRow({
  id,
  value,
  onOpen,
}: {
  id: string;
  value: DatePriority;
  onOpen: () => void;
}) {
  const words = useT().planFromCalendar.priority;
  return (
    <button
      id={id}
      type="button"
      onClick={onOpen}
      className="glass flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-foreground">
        {words.label}
      </span>
      <span className="text-[0.9375rem] font-semibold text-primary">{words[value]}</span>
      <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
