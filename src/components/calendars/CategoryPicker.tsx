import { useId, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import type { CalendarChange } from "@/api/calendars";
import PickerButton from "@/components/calendars/PickerButton";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/lang";
import {
  CATEGORIES,
  categoryLabel,
  ownCategories,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import { MAX_CATEGORY_NAME_LENGTH } from "@/lib/calendarCategories";
import type { CalendarPurpose } from "@/types";

/**
 * A calendar's category on a phone (#220): its button grows into the choices
 * as list rows, the four and the person's own, with "Ny kategori" under them.
 * A new one, in a sheet of its own, is a name and how it behaves: the kind underneath is what
 * scheduling reads (`purpose`), so a trip may overlap it or not, and the name
 * is only ever shown to its owner.
 */
export default function CategoryPicker({
  calendar,
  calendars,
  anchorId,
  disabled,
  onChange,
}: {
  calendar: OverviewCalendar;
  /** Every calendar, for the person's own categories. */
  calendars: OverviewCalendar[];
  /** What the choices grow out of: the calendar's whole row, for its width. */
  anchorId: string;
  disabled: boolean;
  onChange: (change: Extract<CalendarChange, { purpose: CalendarPurpose | null }>) => void;
}) {
  const t = useT();
  const words = t.calendarView;
  const group = useId();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [soft, setSoft] = useState(false);
  const own = ownCategories(calendars);

  const closeNew = () => {
    setCreating(false);
    setName("");
    setSoft(false);
  };
  const pick = (change: Parameters<typeof onChange>[0]) => {
    onChange(change);
    setOpen(false);
    closeNew();
  };
  const trimmed = name.trim();

  return (
    <>
      <PickerButton
        label={
          calendar.purposeGuessed
            ? `${words.categoryFor(calendar.name)}, ${t.aiPlan.guessed}`
            : words.categoryFor(calendar.name)
        }
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {calendar.purposeGuessed && <Sparkles aria-hidden className="h-3 w-3 text-amber-500" />}
        <span className="truncate">{categoryLabel(calendar, t.categories, words.noCategory)}</span>
      </PickerButton>
      <AnchoredPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorId={anchorId}
        label={words.categoryFor(calendar.name)}
      >
        <ListGroup className="mt-0">
          <ListPickRow
            type="radio"
            name={group}
            checked={calendar.purpose === null}
            onChange={() => pick({ purpose: null })}
            label={words.noCategory}
          />
          {CATEGORIES.map((category) => (
            <ListPickRow
              key={category}
              type="radio"
              name={group}
              checked={calendar.purpose === category && !calendar.categoryName}
              onChange={() => pick({ purpose: category })}
              label={t.categories[category]}
            />
          ))}
          {own.map((category) => (
            <ListPickRow
              key={category.name}
              type="radio"
              name={group}
              checked={calendar.categoryName === category.name}
              onChange={() => pick({ purpose: category.purpose, categoryName: category.name })}
              label={category.name}
            />
          ))}
        </ListGroup>
        <ListGroup className="mt-3">
          <ListRow
            icon={Plus}
            tone="primary"
            label={words.newCategory}
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
          />
        </ListGroup>
      </AnchoredPanel>
      {/* A sheet of its own, not the panel: typing opens the keyboard, which
          scrolled the page under a panel pinned to its row and hid the form. */}
      <Sheet
        open={creating}
        onClose={closeNew}
        title={words.newCategory}
        closeLabel={t.common.cancel}
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) pick({ purpose: soft ? "work" : "personal", categoryName: trimmed });
        }}
        footer={
          <FlowButton type="submit" disabled={!trimmed}>
            {words.newCategorySave}
          </FlowButton>
        }
      >
        <label className={FIELD_LABEL} htmlFor={`${group}-name`}>
          {words.newCategoryName}
        </label>
        <input
          id={`${group}-name`}
          autoFocus
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          placeholder={words.newCategoryPlaceholder}
          className={FIELD}
        />
        <ListGroup title={words.newCategoryAsk} className="mt-4">
          <ListPickRow
            type="radio"
            name={`${group}-soft`}
            checked={soft}
            onChange={() => setSoft(true)}
            label={words.newCategoryYes}
          />
          <ListPickRow
            type="radio"
            name={`${group}-soft`}
            checked={!soft}
            onChange={() => setSoft(false)}
            label={words.newCategoryNo}
          />
        </ListGroup>
      </Sheet>
    </>
  );
}
