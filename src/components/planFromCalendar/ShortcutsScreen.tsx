import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Ellipsis, Plus, X } from "lucide-react";

import Notice from "@/components/ui/Notice";
import { useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import { describeDays } from "@/lib/scheduler";
import { MAX_SHORTCUTS, timeLabel, type Shortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** A square's frame: three across, as tall as wide. */
const SQUARE = "relative aspect-square rounded-2xl border bg-card";
const NAME = "line-clamp-3 break-words text-center font-semibold leading-tight text-foreground";
/** How a square moves between the grid and the preview: a soft spring. */
const FLY = { type: "spring", stiffness: 380, damping: 32 } as const;

/**
 * Genveje (#175), the Planlæg sheet's screen to its side: a square for each
 * saved plan, three across, its name big in the middle, "..." in its top
 * corner opening it to change. Plus squares fill the first row, then come
 * one at a time, until there are MAX_SHORTCUTS.
 *
 * A tap doesn't run it: its square flies down to the bottom of the screen
 * and grows to half its width (`selected`), its times listed beside it, so
 * what is about to be searched is seen first; the sheet's "Find dato" under
 * it runs it. A tap on the big square, or on another, sends it back.
 *
 * Saving shows at once: a genvej still on its way to the server pops into
 * its square (`savingId`, its "..." held back until it has an id), and one
 * that didn't make it (`failed`) stands in red, a tap trying again.
 */
export default function ShortcutsScreen({
  shortcuts,
  error,
  selected,
  onSelect,
  onEdit,
  onNew,
  savingId,
  failed,
  onRetry,
  onDismiss,
}: {
  shortcuts: Shortcut[] | undefined;
  error: string | null;
  /** The genvej shown big at the bottom, to run. */
  selected: Shortcut | null;
  onSelect: (shortcut: Shortcut | null) => void;
  onEdit: (shortcut: Shortcut) => void;
  onNew: () => void;
  savingId: string | null;
  failed: { name: string; message: string } | null;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const words = t.shortcuts;
  const reduce = useReducedMotion();
  const list = shortcuts ?? [];
  const n = list.length + (failed ? 1 : 0);
  const adds = n >= MAX_SHORTCUTS ? 0 : n < 3 ? 3 - n : 1;

  return (
    <LayoutGroup>
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
              <li key={s.id} className="relative aspect-square">
                {/* The one in the preview leaves its place empty, outlined. */}
                {s.id === selected?.id ? (
                  <span className="absolute inset-0 rounded-2xl border border-dashed" />
                ) : (
                  <motion.div
                    layoutId={`shortcut-${s.id}`}
                    // A genvej just saved pops into its square.
                    initial={s.id === savingId && !reduce ? { scale: 0.85, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={FLY}
                    className={cn(SQUARE, "h-full")}
                  >
                    <button
                      type="button"
                      aria-label={words.run(s.name)}
                      onClick={() => onSelect(s)}
                      className="flex h-full w-full items-center justify-center rounded-2xl p-3 transition active:scale-95"
                    >
                      <span className={cn(NAME, "text-[17px]")}>{s.name}</span>
                    </button>
                    {s.id !== savingId && (
                      <button
                        type="button"
                        aria-label={words.edit(s.name)}
                        onClick={() => onEdit(s)}
                        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground"
                      >
                        <Ellipsis className="h-5 w-5" />
                      </button>
                    )}
                  </motion.div>
                )}
              </li>
            ))}
        {failed && (
          <li className={cn(SQUARE, "border-red-300 bg-red-50")}>
            <button
              type="button"
              aria-label={`${failed.name}: ${words.notSaved}`}
              title={failed.message}
              onClick={onRetry}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl p-3 pt-7 transition active:scale-95"
            >
              <span className={cn(NAME, "text-[17px]")}>{failed.name}</span>
              <span className="text-center text-[12px] leading-tight text-red-700">
                {words.notSaved}
              </span>
            </button>
            <button
              type="button"
              aria-label={words.dismiss(failed.name)}
              onClick={onDismiss}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        )}
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

      {/* The genvej about to run, at the bottom: big on the left, what it looks at on the right. */}
      {selected && (
        <section aria-label={selected.name} className="mt-auto flex items-end gap-4 pt-6">
          <motion.div
            layoutId={`shortcut-${selected.id}`}
            transition={FLY}
            className={cn(SQUARE, "w-1/2 shrink-0")}
          >
            <button
              type="button"
              aria-label={words.back(selected.name)}
              onClick={() => onSelect(null)}
              className="flex h-full w-full items-center justify-center rounded-2xl p-4"
            >
              <span className={cn(NAME, "text-[24px]")}>{selected.name}</span>
            </button>
          </motion.div>
          <ShortcutFacts shortcut={selected} />
        </section>
      )}
    </LayoutGroup>
  );
}

/** What a genvej looks at: each time start to end, its days; a trip's length. */
function ShortcutFacts({ shortcut }: { shortcut: Shortcut }) {
  const t = useT();
  const words = t.shortcuts;
  const { settings, times } = shortcut.plan;
  const days = describeDays(settings.dows);
  const daysLabel =
    days.kind === "list"
      ? days.dows.map((d) => t.weekdaysShort[d]).join(", ")
      : capitalize(t.scheduler.dayList[days.kind]);
  return (
    <motion.ul
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.15 }}
      className="flex min-w-0 flex-1 flex-col gap-3 pb-1"
    >
      {settings.multiDay ? (
        <li>
          <p className="text-[13px] text-muted-foreground">{t.scheduler.tripDays}</p>
          <p className="text-[17px] font-semibold text-foreground">
            {t.common.days(settings.days)}
          </p>
        </li>
      ) : (
        times.map((time, i) => (
          <li key={i}>
            <p className="text-[13px] text-muted-foreground">{words.time(i + 1)}</p>
            <p className="text-[17px] font-semibold text-foreground">
              {timeLabel(time, settings.durationMinutes, words.anyTime)}
            </p>
          </li>
        ))
      )}
      {!settings.multiDay && <li className="text-[13px] text-muted-foreground">{daysLabel}</li>}
    </motion.ul>
  );
}
