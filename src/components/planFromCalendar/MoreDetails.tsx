import { useId, useState } from "react";
import { ArrowUpDown, Hourglass, MapPin, SlidersHorizontal, StickyNote } from "lucide-react";

import { DeadlinePicker } from "@/components/myEvents/VoteDeadline";
import Collapse from "@/components/ui/Collapse";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import {
  DEFAULT_EXTRAS,
  MAX_NOTE_LENGTH,
  MAX_PLACE_LENGTH,
  type EventExtras,
} from "@/lib/scheduler";

import { DatePriorityPicker } from "./DatePriority";
import FieldRow, { ROW_INPUT } from "./FieldRow";
import { litClass } from "./fill";

/**
 * What most plans never touch (#173), folded behind one "Flere detaljer" row
 * at the sheet's end: the place and note, typed into their rows, a deadline
 * for the answers (#179, none unless chosen) and what the dates are ranked
 * by. Open from the start when any of it is set, so nothing chosen is hidden.
 * Who is coming is "Hvor mange skal kunne" up front (#259); picking people
 * one by one is gone from the phone, to come back as a paid feature (#260).
 * The computer has the same settings in its box's tabs.
 */
export default function MoreDetails({
  extras,
  onExtras,
  lit = false,
}: {
  /** Casy is filling these in right now (#173). */
  lit?: boolean;
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
}) {
  const t = useT();
  const words = t.settingsPanel;
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  // The rows the pickers grow out of (#175).
  const id = useId();
  const rows = { deadline: `${id}-deadline`, priority: `${id}-priority` };

  const [open, setOpen] = useState(
    () =>
      extras.place !== "" ||
      extras.note !== "" ||
      extras.answerDays !== null ||
      extras.priority !== DEFAULT_EXTRAS.priority,
  );

  return (
    <>
      <ListGroup className="mt-4">
        <ListRow
          className={litClass(lit ? "more" : null, "more")}
          icon={SlidersHorizontal}
          label={t.planFromCalendar.more}
          expanded={open}
          onClick={() => setOpen((o) => !o)}
        />
      </ListGroup>
      <Collapse open={open} follow>
        <ListGroup className="mt-3">
          <FieldRow icon={MapPin} label={words.place.where}>
            <input
              type="text"
              value={extras.place}
              maxLength={MAX_PLACE_LENGTH}
              onChange={(e) => onExtras({ place: e.target.value })}
              placeholder={words.place.wherePlaceholder}
              className={ROW_INPUT}
            />
          </FieldRow>
          <FieldRow icon={StickyNote} label={words.place.note}>
            <input
              type="text"
              value={extras.note}
              maxLength={MAX_NOTE_LENGTH}
              onChange={(e) => onExtras({ note: e.target.value })}
              placeholder={words.place.notePlaceholder}
              className={ROW_INPUT}
            />
          </FieldRow>
          <ListRow
            id={rows.deadline}
            icon={Hourglass}
            label={t.voteDeadline.label}
            value={
              extras.answerDays === null ? t.voteDeadline.none : t.common.days(extras.answerDays)
            }
            chevron
            onClick={() => setDeadlineOpen(true)}
          />
          <ListRow
            id={rows.priority}
            icon={ArrowUpDown}
            label={t.planFromCalendar.priority.label}
            value={t.planFromCalendar.priority[extras.priority]}
            chevron
            onClick={() => setPriorityOpen(true)}
          />
        </ListGroup>
      </Collapse>
      <DeadlinePicker
        open={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
        anchorId={rows.deadline}
        value={extras.answerDays}
        onPick={(answerDays) => onExtras({ answerDays })}
      />
      <DatePriorityPicker
        open={priorityOpen}
        onClose={() => setPriorityOpen(false)}
        anchorId={rows.priority}
        value={extras.priority}
        onPick={(priority) => onExtras({ priority })}
      />
    </>
  );
}
