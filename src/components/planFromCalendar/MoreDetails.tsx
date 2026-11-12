import { useId, useState } from "react";
import { ArrowUpDown, Hourglass, MapPin, SlidersHorizontal, StickyNote, Users } from "lucide-react";

import type { ParticipantProps } from "@/components/findDate/ParticipantSettings";
import { DeadlinePicker } from "@/components/myEvents/VoteDeadline";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import Collapse from "@/components/ui/Collapse";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import {
  DEFAULT_EXTRAS,
  MAX_NOTE_LENGTH,
  MAX_PLACE_LENGTH,
  type EventExtras,
} from "@/lib/scheduler";
import { summarizePeople } from "@/lib/peopleSummary";

import { DatePriorityPicker } from "./DatePriority";
import FieldRow, { ROW_INPUT } from "./FieldRow";
import { litClass } from "./fill";
import PeopleRows from "./PeopleRows";

/**
 * What most plans never touch (#173), folded behind one "Flere detaljer" row
 * at the sheet's end: who is coming (a sheet of its own), the place and
 * note, typed into their rows, and a deadline for the answers (#179, none
 * unless chosen). Open from the start when any of it is set, so
 * nothing chosen is hidden. The computer has the same settings in its box's tabs.
 * A genvej's editor has no one to choose from (#233), so no `participants`.
 */
export default function MoreDetails({
  extras,
  onExtras,
  participants,
  lit = false,
}: {
  /** Casy is filling these in right now (#173). */
  lit?: boolean;
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  participants?: ParticipantProps;
}) {
  const t = useT();
  const words = t.settingsPanel;
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  // The rows the pickers grow out of (#175).
  const id = useId();
  const rows = { people: `${id}-people`, deadline: `${id}-deadline`, priority: `${id}-priority` };

  const people =
    participants &&
    summarizePeople(
      participants.members.map((m) => m.profileId),
      participants.choice,
      participants.meeting,
    );
  const peopleValue =
    !participants || !people || participants.example || participants.members.length === 0
      ? null
      : people.everyone
        ? t.schedulerFlow.peopleAll(people.total)
        : t.schedulerFlow.peopleSome(people.required, people.optional) +
          (people.atLeast !== null ? t.schedulerFlow.peopleAtLeast(people.atLeast) : "");
  const [open, setOpen] = useState(
    () =>
      extras.place !== "" ||
      extras.note !== "" ||
      extras.answerDays !== null ||
      extras.priority !== DEFAULT_EXTRAS.priority ||
      // Someone picked by hand; a count alone is the row up front (#259).
      (!!people && people.required !== people.total),
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
          {participants && (
            <ListRow
              id={rows.people}
              icon={Users}
              label={words.tabs.people}
              value={peopleValue}
              chevron
              onClick={() => setPeopleOpen(true)}
            />
          )}
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

      {participants && (
        <AnchoredPanel
          open={peopleOpen}
          onClose={() => setPeopleOpen(false)}
          anchorId={rows.people}
          label={words.tabs.people}
        >
          <PeopleRows {...participants} />
        </AnchoredPanel>
      )}
    </>
  );
}
