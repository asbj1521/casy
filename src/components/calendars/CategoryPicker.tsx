import { useId, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import type { CalendarChange } from "@/api/calendars";
import NewCategorySheet from "@/components/calendars/NewCategorySheet";
import PickerButton from "@/components/calendars/PickerButton";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import {
  CATEGORIES,
  categoryLabel,
  ownCategories,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import type { CalendarPurpose } from "@/types";

/**
 * A calendar's category on a phone (#220): its button grows into the choices
 * as list rows, the four and the person's own, with "Ny kategori" under them
 * (NewCategorySheet).
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
  const own = ownCategories(calendars);

  const pick = (change: Parameters<typeof onChange>[0]) => {
    onChange(change);
    setOpen(false);
  };

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
      <NewCategorySheet
        open={creating}
        onClose={() => setCreating(false)}
        onSave={(category) => {
          pick(category);
          setCreating(false);
        }}
      />
    </>
  );
}
