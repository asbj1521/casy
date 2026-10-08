import { useId, useState } from "react";
import { MapPin, StickyNote, Users } from "lucide-react";

import ParticipantSettings, {
  type ParticipantProps,
} from "@/components/findDate/ParticipantSettings";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Modal, { ModalPanel } from "@/components/ui/Modal";
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
  const titleId = useId();

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

      <Modal open={peopleOpen} placement="bottom" onClose={() => setPeopleOpen(false)}>
        <ModalPanel
          labelledBy={titleId}
          className="max-h-[85dvh] rounded-b-none border-x-0 border-b-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id={titleId} className="text-[17px] font-bold text-foreground">
              {words.tabs.people}
            </h3>
            <button
              type="button"
              onClick={() => setPeopleOpen(false)}
              className="rounded-lg px-2 py-1 text-[15px] font-semibold text-primary"
            >
              {t.schedulerFlow.done}
            </button>
          </div>
          <ParticipantSettings {...participants} rows />
        </ModalPanel>
      </Modal>
    </>
  );
}
