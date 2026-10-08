import { useState } from "react";
import { MapPin, StickyNote, Users } from "lucide-react";

import ParticipantSettings, {
  type ParticipantProps,
} from "@/components/findDate/ParticipantSettings";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import BottomSheet from "@/components/ui/BottomSheet";
import { useT } from "@/i18n/lang";
import { MAX_NOTE_LENGTH, MAX_PLACE_LENGTH, type EventExtras } from "@/lib/scheduler";
import { summarizePeople } from "@/lib/schedulerFlow";

import FieldRow, { ROW_INPUT } from "./FieldRow";

/**
 * The flow's optional step (#101), as a short list to take in at a glance:
 * one row per setting, its name on the left and how it stands on the right.
 * The place and note are typed into their rows, and who is coming opens a
 * sheet of its own. How the vote runs is set on the dates step, beside the
 * dates it is about. The computer has the same settings in its box's tabs;
 * the ones coming soon stay off the phone.
 */
export default function DetailsStep({
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

  return (
    <>
      <ListGroup className="mt-0">
        <ListRow
          icon={Users}
          label={words.tabs.people}
          value={peopleValue}
          chevron
          onClick={() => setPeopleOpen(true)}
        />
      </ListGroup>

      <ListGroup>
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

      <BottomSheet
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        title={words.tabs.people}
        doneLabel={t.schedulerFlow.done}
      >
        <ParticipantSettings {...participants} rows />
      </BottomSheet>
    </>
  );
}
