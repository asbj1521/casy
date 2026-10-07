import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import Dropdown from "@/components/Dropdown";
import { useT } from "@/i18n/lang";
import {
  ANSWER_DAY_VALUES,
  DATE_COUNT_VALUES,
  MAX_NOTE_LENGTH,
  MAX_PLACE_LENGTH,
  type EventExtras,
} from "@/lib/scheduler";

/**
 * The settings a suggestion carries besides its search: Sted og note (#84)
 * and Afstemning (#99). Drawn in the computer's settings box as tabs and on
 * a phone's Flere indstillinger as sections, from the same components.
 */
interface Props {
  extras: EventExtras;
  onChange: (patch: Partial<EventExtras>) => void;
}

const INPUT =
  "h-11 w-full rounded-xl border bg-card px-3.5 text-base font-semibold text-foreground outline-none transition placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";
const TRIGGER =
  "inline-flex h-11 items-center gap-2 rounded-xl border bg-card px-3.5 text-base font-bold text-foreground transition hover:bg-secondary";

function Label({ text, children, grow }: { text: string; children: ReactNode; grow?: boolean }) {
  return (
    <label className={grow ? "flex min-w-[10rem] flex-1 flex-col gap-2" : "flex flex-col gap-2"}>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {text}
      </span>
      {children}
    </label>
  );
}

/** Where the group meets, and what the others should know. Both optional. */
export function PlaceNoteSettings({ extras, onChange }: Props) {
  const t = useT();
  const words = t.settingsPanel.place;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{words.intro}</p>
      <div className="flex flex-wrap gap-4">
        <Label text={words.where} grow>
          <input
            type="text"
            value={extras.place}
            maxLength={MAX_PLACE_LENGTH}
            onChange={(e) => onChange({ place: e.target.value })}
            placeholder={words.wherePlaceholder}
            className={INPUT}
          />
        </Label>
        <Label text={words.note} grow>
          <input
            type="text"
            value={extras.note}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder={words.notePlaceholder}
            className={INPUT}
          />
        </Label>
      </div>
    </div>
  );
}

/** How long everyone has to answer, and how many dates they vote on. */
export function VoteSettings({ extras, onChange }: Props) {
  const t = useT();
  const words = t.settingsPanel.vote;
  const chevron = <ChevronDown className="h-4 w-4 text-muted-foreground" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{words.intro}</p>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {words.deadline}
          </span>
          <Dropdown
            value={extras.answerDays}
            options={ANSWER_DAY_VALUES.map((d) => ({ label: t.common.days(d), value: d }))}
            onChange={(answerDays) => onChange({ answerDays })}
            suffix={chevron}
            triggerClassName={TRIGGER}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {words.dates}
          </span>
          <Dropdown
            value={extras.dateCount}
            options={DATE_COUNT_VALUES.map((n) => ({ label: words.upTo(n), value: n }))}
            onChange={(dateCount) => onChange({ dateCount })}
            suffix={chevron}
            triggerClassName={TRIGGER}
          />
        </div>
      </div>
    </div>
  );
}
