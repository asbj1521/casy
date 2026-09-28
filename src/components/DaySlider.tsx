import { useT } from "@/i18n/lang";
import { ALL_DOWS } from "@/lib/weekdays";
import { cn } from "@/lib/utils";

/**
 * The day picker: the seven weekdays on one row, Monday first, each a toggle.
 * Filled accent chips are the days being searched (or, for a trip, the days
 * the trip covers); plain chips are off. Days never move, so the row is the
 * same size whatever is picked, and at least one day always stays on.
 *
 * The chips are flex-1 in a row that never wraps, so seven of them share the
 * panel's width evenly at any size.
 */
export default function DaySlider({
  selected,
  onChange,
}: {
  /** Currently active days, as local day-of-week values. */
  selected: number[];
  onChange: (dows: number[]) => void;
}) {
  const t = useT();

  function toggle(d: number) {
    if (selected.includes(d)) {
      if (selected.length <= 1) return; // at least one day must stay active
      onChange(selected.filter((x) => x !== d));
    } else {
      onChange([...selected, d]);
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      {ALL_DOWS.map((d) => {
        const on = selected.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            aria-pressed={on}
            className={cn(
              "min-w-0 flex-1 rounded-md py-1.5 text-xs transition-colors",
              on
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-secondary font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {t.weekdaysShort[d]}
          </button>
        );
      })}
    </div>
  );
}
