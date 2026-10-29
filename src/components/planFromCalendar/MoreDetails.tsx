import { useState } from "react";
import { MapPin, SlidersHorizontal, StickyNote, Users } from "lucide-react";

import type { ParticipantProps } from "@/components/findDate/ParticipantSettings";
import BottomSheet from "@/components/ui/BottomSheet";
import Collapse from "@/components/ui/Collapse";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { MAX_NOTE_LENGTH, MAX_PLACE_LENGTH, type EventExtras } from "@/lib/scheduler";
import { summarizePeople } from "@/lib/peopleSummary";

import FieldRow, { ROW_INPUT } from "./FieldRow";
import PeopleRows from "./PeopleRows";

/**
 * What most plans never touch (#173), folded behind one "Flere detaljer" row
 * at the sheet's end: who is coming (a sheet of its own), and the place and
 * note, typed into their rows. Open from the start when any of it is set, so
 * nothing chosen is hidden. The computer has the same settings in its box's tabs.
 */
export default function MoreDetails({
  extras,
  onExtras,
  participants,
}: {
  extras: EventExtras;
  onExtras: (patch: Partial<EventExtras>) => void;
  participants: ParticipantProps;
}) {
  const t = useT();
  const words = t.settingsPanel;
  const [peopleOpen, setPeopleOpen] = useState(false);

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
    () => extras.place !== "" || extras.note !== "" || !people.everyone,
  );

  return (
    <>
      <ListGroup className="mt-4">
        <ListRow
          icon={SlidersHorizontal}
          label={t.planFromCalendar.more}
          expanded={open}
          onClick={() => setOpen((o) => !o)}
        />
      </ListGroup>
      <Collapse open={open}>
        <ListGroup className="mt-3">
          <ListRow
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
        </ListGroup>
      </Collapse>

      <BottomSheet
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        title={words.tabs.people}
        doneLabel={t.schedulerFlow.done}
      >
        <PeopleRows {...participants} />
      </BottomSheet>
    </>
  );
}
