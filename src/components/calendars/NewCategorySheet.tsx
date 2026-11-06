import { useId, useState } from "react";

import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow } from "@/components/ui/ListGroup";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/lang";
import { MAX_CATEGORY_NAME_LENGTH } from "@/lib/calendarCategories";
import type { CalendarPurpose } from "@/types";

/**
 * A category of the person's own (#220): a name and how it behaves. The kind
 * underneath is what scheduling reads (`purpose`), so a trip may overlap it or
 * not, and the name is only ever shown to its owner. A sheet, not a panel pinned
 * to a row: typing opens the keyboard, which scrolled the page under a panel and
 * hid the form.
 */
export default function NewCategorySheet({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (category: { purpose: CalendarPurpose; categoryName: string }) => void;
}) {
  const t = useT();
  const words = t.calendarView;
  const id = useId();
  const [name, setName] = useState("");
  const [soft, setSoft] = useState(false);
  const trimmed = name.trim();

  const reset = () => {
    setName("");
    setSoft(false);
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={words.newCategory}
      closeLabel={t.common.cancel}
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        onSave({ purpose: soft ? "work" : "personal", categoryName: trimmed });
        reset();
      }}
      footer={
        <FlowButton type="submit" disabled={!trimmed}>
          {words.newCategorySave}
        </FlowButton>
      }
    >
      <label className={FIELD_LABEL} htmlFor={`${id}-name`}>
        {words.newCategoryName}
      </label>
      <input
        id={`${id}-name`}
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
          name={`${id}-soft`}
          checked={soft}
          onChange={() => setSoft(true)}
          label={words.newCategoryYes}
        />
        <ListPickRow
          type="radio"
          name={`${id}-soft`}
          checked={!soft}
          onChange={() => setSoft(false)}
          label={words.newCategoryNo}
        />
      </ListGroup>
    </Sheet>
  );
}
