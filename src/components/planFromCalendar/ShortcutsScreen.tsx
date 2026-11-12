import { useState, type ReactNode } from "react";
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
 * A tap doesn't run it: the other squares give way and its square flies to
 * the top, half the screen wide (`selected`), its times listed beside it, so
 * what is about to be searched is seen first, with the whole screen for the
 * rows under it (#259: the group, Hvornår, how many need to come); the
 * sheet's "Find dato" runs it. A tap on the big square sends it back and
 * brings the others back.
 *
 * A genvej with a picture (#186) has it filling its square, its name over
 * the picture's foot.
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
  runRows,
}: {
  shortcuts: Shortcut[] | undefined;
  error: string | null;
  /** The genvej shown big on its own, to run. */
  selected: Shortcut | null;
  onSelect: (shortcut: Shortcut | null) => void;
  onEdit: (shortcut: Shortcut) => void;
  onNew: () => void;
  savingId: string | null;
  failed: { name: string; message: string } | null;
  onRetry: () => void;
  onDismiss: () => void;
  /** Under the genvej about to run (#259): its group, how many need to come, and when. */
  runRows: ReactNode;
}) {
  const t = useT();
  const words = t.shortcuts;
  const reduce = useReducedMotion();
  // The genvej flying back into the grid, kept over the squares after it
  // (a plus tile's dashed edge showed across its picture) until it lands.
  const [returning, setReturning] = useState<string | null>(null);
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
      {/* The squares give way to the one about to run (#259). */}
      {!selected && (
        <ul className="grid grid-cols-3 gap-3">
          {shortcuts === undefined
            ? // On their way: the squares, held.
              [0, 1, 2].map((i) => (
                <li key={i} className={cn(SQUARE, "animate-pulse bg-secondary")} />
              ))
            : list.map((s) => (
                <li
                  key={s.id}
                  className={cn("relative aspect-square", s.id === returning && "z-10")}
                >
                  <motion.div
                    layoutId={`shortcut-${s.id}`}
                    onLayoutAnimationComplete={() => s.id === returning && setReturning(null)}
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
                      <ShortcutFace shortcut={s} size="text-[1.0625rem]" />
                    </button>
                    {s.id !== savingId && (
                      <button
                        type="button"
                        aria-label={words.edit(s.name)}
                        onClick={() => onEdit(s)}
                        className={cn(
                          "absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full",
                          // Over a picture it needs its own ground to be seen.
                          s.pictureUrl ? "bg-black/30 text-white" : "text-muted-foreground",
                        )}
                      >
                        <Ellipsis className="h-5 w-5" />
                      </button>
                    )}
                  </motion.div>
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
                <span className={cn(NAME, "text-[1.0625rem]")}>{failed.name}</span>
                <span className="text-center text-[0.75rem] leading-tight text-red-700">
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
      )}
      {/* With none yet, three bare plus tiles say nothing on their own (#213). */}
      {shortcuts?.length === 0 && !failed && (
        <p className="mt-3 px-1 text-[0.75rem] text-muted-foreground">{words.emptyNote}</p>
      )}

      {/* The genvej about to run, on its own: big on the left, what it looks at on the right. */}
      {selected && (
        <div>
          <section aria-label={selected.name} className="flex items-end gap-4">
            <motion.div
              layoutId={`shortcut-${selected.id}`}
              transition={FLY}
              className={cn(SQUARE, "w-1/2 shrink-0")}
            >
              <button
                type="button"
                aria-label={words.back(selected.name)}
                onClick={() => {
                  setReturning(selected.id);
                  onSelect(null);
                }}
                className="flex h-full w-full items-center justify-center rounded-2xl p-4"
              >
                <ShortcutFace shortcut={selected} size="text-[1.5rem]" />
              </button>
            </motion.div>
            <ShortcutFacts shortcut={selected} />
          </section>
          {/* Who and when it runs for, seen and changeable before it runs. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="mt-4"
          >
            {runRows}
          </motion.div>
        </div>
      )}
    </LayoutGroup>
  );
}

/**
 * What a square shows: the genvej's name in the middle, or its picture
 * filling it with the name at its foot. A picture that won't load leaves
 * the name alone.
 */
function ShortcutFace({ shortcut, size }: { shortcut: Shortcut; size: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = shortcut.pictureUrl;
  if (!src || broken === src) return <span className={cn(NAME, size)}>{shortcut.name}</span>;
  return (
    <>
      <img
        src={src}
        alt=""
        onError={() => setBroken(src)}
        className="absolute inset-0 h-full w-full rounded-2xl object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/65 to-transparent px-2 pb-2 pt-8">
        <span className={cn(NAME, size, "line-clamp-2 text-white")}>{shortcut.name}</span>
      </span>
    </>
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
          <p className="text-[0.8125rem] text-muted-foreground">{t.scheduler.tripDays}</p>
          <p className="text-[1.0625rem] font-semibold text-foreground">
            {t.common.days(settings.days)}
          </p>
        </li>
      ) : (
        times.map((time, i) => (
          <li key={i}>
            <p className="text-[0.8125rem] text-muted-foreground">{words.time(i + 1)}</p>
            <p className="text-[1.0625rem] font-semibold text-foreground">
              {timeLabel(time, words.anyTime)}
            </p>
          </li>
        ))
      )}
      {!settings.multiDay && (
        <li className="text-[0.8125rem] text-muted-foreground">{daysLabel}</li>
      )}
    </motion.ul>
  );
}
