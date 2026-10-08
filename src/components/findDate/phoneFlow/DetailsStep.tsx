import { useId, useState, type ReactNode } from "react";
import { CalendarRange, ChevronDown, Hourglass, MapPin, StickyNote, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import Dropdown from "@/components/Dropdown";
import ParticipantSettings, {
  type ParticipantProps,
} from "@/components/findDate/ParticipantSettings";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Modal, { ModalPanel } from "@/components/ui/Modal";
import { useT } from "@/i18n/lang";
import {
  ANSWER_DAY_VALUES,
  DATE_COUNT_VALUES,
  MAX_NOTE_LENGTH,
  MAX_PLACE_LENGTH,
  type EventExtras,
} from "@/lib/scheduler";
import { summarizePeople } from "@/lib/schedulerFlow";

/**
 * The flow's optional step (#101), as a short list to take in at a glance:
 * one row per setting, its name on the left and how it stands on the right.
 * The place and note are typed into their rows, the vote's two numbers open
 * a wheel, and who is coming opens a sheet of its own. The computer has the
 * same settings in its box's tabs; the ones coming soon stay off the phone.
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
  const chevron = <ChevronDown className="h-4 w-4 shrink-0" />;
  const pick =
    "flex items-center gap-1 whitespace-nowrap text-[15px] text-muted-foreground transition hover:text-foreground";

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
            className={INPUT}
          />
        </FieldRow>
        <FieldRow icon={StickyNote} label={words.place.note}>
          <input
            type="text"
            value={extras.note}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(e) => onExtras({ note: e.target.value })}
            placeholder={words.place.notePlaceholder}
            className={INPUT}
          />
        </FieldRow>
      </ListGroup>

      <ListGroup>
        <FieldRow icon={Hourglass} label={words.vote.deadline} labelled={false}>
          <Dropdown
            value={extras.answerDays}
            options={ANSWER_DAY_VALUES.map((d) => ({ label: t.common.days(d), value: d }))}
            onChange={(answerDays) => onExtras({ answerDays })}
            suffix={chevron}
            triggerClassName={pick}
          />
        </FieldRow>
        <FieldRow icon={CalendarRange} label={words.vote.dates} labelled={false}>
          <Dropdown
            value={extras.dateCount}
            options={DATE_COUNT_VALUES.map((n) => ({ label: words.vote.upTo(n), value: n }))}
            onChange={(dateCount) => onExtras({ dateCount })}
            suffix={chevron}
            triggerClassName={pick}
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

const INPUT =
  "min-w-0 flex-1 bg-transparent text-right text-[15px] text-foreground outline-none placeholder:text-muted-foreground";

/**
 * A row like ListRow's, with a control on the right instead of a value. A
 * text field's row is its label, so a tap anywhere on it starts typing; a
 * button names itself, so its row is plain (`labelled={false}`).
 */
function FieldRow({
  icon: Icon,
  label,
  labelled = true,
  children,
}: {
  icon: LucideIcon;
  label: string;
  labelled?: boolean;
  children: ReactNode;
}) {
  const Row = labelled ? "label" : "div";
  return (
    <li className="group/row">
      <Row className="flex w-full items-center gap-3 pl-4">
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 border-t py-2.5 pr-4 group-first/row:border-t-0">
          <span className="shrink-0 text-[15px] font-medium text-foreground">{label}</span>
          <span className="flex min-w-0 flex-1 justify-end">{children}</span>
        </span>
      </Row>
    </li>
  );
}
