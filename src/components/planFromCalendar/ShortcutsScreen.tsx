import { Ellipsis, Plus } from "lucide-react";

import Notice from "@/components/ui/Notice";
import { useT } from "@/i18n/lang";
import { MAX_SHORTCUTS, timeLabel, type Shortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** A square's frame: three across, as tall as wide. */
const SQUARE = "relative aspect-square rounded-2xl border bg-card";

/**
 * Genveje (#175), the Planlæg sheet's screen to its side: a square for each
 * saved plan, three across, with its name and the times it looks at (a
 * trip's days); a tap runs it with the group chosen in Planlæg, straight
 * into the pile, and "..." in its top corner opens it to change.
 * Squares with a plus fill the row after them (a whole row of three with
 * none yet), until there are as many as can be kept.
 */
export default function ShortcutsScreen({
  shortcuts,
  error,
  onRun,
  onEdit,
  onNew,
}: {
  shortcuts: Shortcut[] | undefined;
  error: string | null;
  onRun: (shortcut: Shortcut) => void;
  onEdit: (shortcut: Shortcut) => void;
  onNew: () => void;
}) {
  const t = useT();
  const words = t.shortcuts;
  const list = shortcuts ?? [];
  const n = list.length;
  const adds = n >= MAX_SHORTCUTS ? 0 : n % 3 === 0 ? 3 : 3 - (n % 3);

  return (
    <>
      {error && (
        <Notice tone="error" bare className="mb-3">
          {error}
        </Notice>
      )}
      <ul className="grid grid-cols-3 gap-3">
        {shortcuts === undefined
          ? // On their way: the squares, held.
            [0, 1, 2].map((i) => (
              <li key={i} className={cn(SQUARE, "animate-pulse bg-secondary")} />
            ))
          : list.map((s) => (
              <li key={s.id} className={SQUARE}>
                <button
                  type="button"
                  aria-label={words.run(s.name)}
                  onClick={() => onRun(s)}
                  className="flex h-full w-full flex-col justify-end gap-1 rounded-2xl p-3 text-left transition active:scale-95"
                >
                  <span className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-foreground">
                    {s.name}
                  </span>
                  {/* Each time on its line, start to end; a trip's days. */}
                  <span className="text-[12px] leading-tight text-muted-foreground">
                    {s.plan.settings.multiDay
                      ? t.common.days(s.plan.settings.days)
                      : s.plan.times.map((time, i) => (
                          <span key={i} className="block truncate">
                            {timeLabel(time, s.plan.settings.durationMinutes, words.anyTime)}
                          </span>
                        ))}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={words.edit(s.name)}
                  onClick={() => onEdit(s)}
                  className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground"
                >
                  <Ellipsis className="h-5 w-5" />
                </button>
              </li>
            ))}
        {shortcuts !== undefined &&
          Array.from({ length: adds }, (_, i) => (
            <li key={`add-${i}`} className={cn(SQUARE, "border-dashed bg-transparent")}>
              <button
                type="button"
                aria-label={words.add}
                onClick={onNew}
                className="flex h-full w-full items-center justify-center rounded-2xl text-primary transition active:scale-95"
              >
                <Plus className="h-7 w-7" />
              </button>
            </li>
          ))}
      </ul>
      <p className="mt-3 px-1 text-[12px] text-muted-foreground">{words.footnote}</p>
    </>
  );
}
