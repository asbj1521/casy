import { useId, useState } from "react";
import { Hourglass, MapPin, SlidersHorizontal, StickyNote, Users } from "lucide-react";

import type { ParticipantProps } from "@/components/findDate/ParticipantSettings";
import { DeadlinePicker } from "@/components/myEvents/VoteDeadline";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import Collapse from "@/components/ui/Collapse";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { MAX_NOTE_LENGTH, MAX_PLACE_LENGTH, type EventExtras } from "@/lib/scheduler";
import { summarizePeople } from "@/lib/peopleSummary";

import FieldRow, { ROW_INPUT } from "./FieldRow";
import { litClass } from "./fill";
import PeopleRows from "./PeopleRows";

/**
 * What most plans never touch (#173), folded behind one "Flere detaljer" row
 * at the sheet's end: who is coming (a sheet of its own), the place and
 * note, typed into their rows, and a deadline for the answers (#179, none
 * unless chosen). Open from the start when any of it is set, so
 * nothing chosen is hidden. The computer has the same settings in its box's tabs.
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
  participants: ParticipantProps;
}) {
  const t = useT();
  const words = t.settingsPanel;
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  // The rows the pickers grow out of (#175).
  const id = useId();
  const rows = { people: `${id}-people`, deadline: `${id}-deadline` };

  const { members, choice, meeting, example } = participants;
  const people = summarizePeople(
    members.map((m) => m.profileId),
    choice,
    meeting,
  );
  const peopleValue =
    example || members.length === 0
      ? null
      : people.everyone
        ? t.schedulerFlow.peopleAll(people.total)
        : t.schedulerFlow.peopleSome(people.required, people.optional) +
          (people.atLeast !== null ? t.schedulerFlow.peopleAtLeast(people.atLeast) : "");
  const [open, setOpen] = useState(
    () =>
      extras.place !== "" || extras.note !== "" || extras.answerDays !== null || !people.everyone,
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
          <ListRow
            id={rows.people}
            icon={Users}
            label={words.tabs.people}
            value={peopleValue}
            chevron
            onClick={() => setPeopleOpen(true)}
          />
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
        </ListGroup>
      </Collapse>
      <DeadlinePicker
        open={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
        anchorId={rows.deadline}
        value={extras.answerDays}
        onPick={(answerDays) => onExtras({ answerDays })}
      />

      <AnchoredPanel
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        anchorId={rows.people}
        label={words.tabs.people}
      >
        <PeopleRows {...participants} />
      </AnchoredPanel>
    </>
  );
}
