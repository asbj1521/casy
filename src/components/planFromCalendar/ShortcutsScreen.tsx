import { Ellipsis, Plus } from "lucide-react";

import GroupBubbles from "@/components/ui/GroupBubbles";
import Notice from "@/components/ui/Notice";
import type { SchedulingGroup } from "@/hooks/useSchedulingGroups";
import { useT } from "@/i18n/lang";
import { MAX_SHORTCUTS, type Shortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** A square's frame: three across, as tall as wide. */
const SQUARE = "relative aspect-square rounded-2xl border bg-card";

/**
 * Genveje (#175), the Planlæg sheet's screen to its side: a square for each
 * saved plan, three across, with its group's members as bubbles and its
 * name; a tap runs it straight into the pile, "..." (in the corner beside
 * the name, clear of the bubbles) opens it to change.
 * Squares with a plus fill the row after them (a whole row of three with
 * none yet), until there are as many as can be kept.
 */
export default function ShortcutsScreen({
  shortcuts,
  groups,
  error,
  onRun,
  onEdit,
  onNew,
}: {
  shortcuts: Shortcut[] | undefined;
  groups: SchedulingGroup[];
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
          : list.map((s) => {
              const group = groups.find((g) => g.id === s.groupId);
              return (
                <li key={s.id} className={SQUARE}>
                  <button
                    type="button"
                    aria-label={words.run(s.name)}
                    // Without its group it can't run: it opens to pick one.
                    onClick={() => (group ? onRun(s) : onEdit(s))}
                    className="flex h-full w-full flex-col justify-between rounded-2xl p-3 text-left transition active:scale-95"
                  >
                    <GroupBubbles members={group?.members ?? []} />
                    <span className="line-clamp-2 break-words pr-6 text-[15px] font-semibold leading-tight text-foreground">
                      {s.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={words.edit(s.name)}
                    onClick={() => onEdit(s)}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground"
                  >
                    <Ellipsis className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
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
