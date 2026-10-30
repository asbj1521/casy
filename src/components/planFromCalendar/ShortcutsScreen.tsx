import { motion, useReducedMotion } from "framer-motion";
import { Ellipsis, Plus, X } from "lucide-react";

import Notice from "@/components/ui/Notice";
import { useT } from "@/i18n/lang";
import { MAX_SHORTCUTS, type Shortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** A square's frame: three across, as tall as wide. */
const SQUARE = "relative aspect-square rounded-2xl border bg-card";

/**
 * Genveje (#175), the Planlæg sheet's screen to its side: a square for each
 * saved plan, three across, its name big in the middle; a tap runs it with
 * the group chosen in Planlæg, straight into the pile, and "..." in its top
 * corner opens it to change. Squares with a plus fill the row after them (a
 * whole row of three with none yet), until there are as many as can be kept.
 *
 * Saving shows at once: a genvej still on its way to the server pops into
 * its square (`savingId`, its "..." held back until it has an id), and one
 * that didn't make it (`failed`) stands in red, a tap trying again.
 */
export default function ShortcutsScreen({
  shortcuts,
  error,
  onRun,
  onEdit,
  onNew,
  savingId,
  failed,
  onRetry,
  onDismiss,
}: {
  shortcuts: Shortcut[] | undefined;
  error: string | null;
  onRun: (shortcut: Shortcut) => void;
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
  const adds = n >= MAX_SHORTCUTS ? 0 : n % 3 === 0 ? 3 : 3 - (n % 3);
  const name = "line-clamp-3 break-words text-center text-[17px] font-semibold leading-tight";

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
              <motion.li
                key={s.id}
                // A genvej just saved pops into its square.
                initial={s.id === savingId && !reduce ? { scale: 0.85, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                className={SQUARE}
              >
                <button
                  type="button"
                  aria-label={words.run(s.name)}
                  onClick={() => onRun(s)}
                  className="flex h-full w-full items-center justify-center rounded-2xl p-3 transition active:scale-95"
                >
                  <span className={cn(name, "text-foreground")}>{s.name}</span>
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
              </motion.li>
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
              <span className={cn(name, "text-foreground")}>{failed.name}</span>
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
      <p className="mt-3 px-1 text-[12px] text-muted-foreground">{words.footnote}</p>
    </>
  );
}
