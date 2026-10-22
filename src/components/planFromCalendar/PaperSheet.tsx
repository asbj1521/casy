import { motion } from "framer-motion";

import { useLang } from "@/i18n/lang";
import type { PileSheet, SheetDay } from "@/lib/paperPile";
import { cn } from "@/lib/utils";

/** Monday first, as My calendar and Apple's month view. */
const WEEKDAYS = {
  da: ["M", "T", "O", "T", "F", "L", "S"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

/** How each kind of day is marked on paper. */
const MARK: Record<SheetDay, string> = {
  free: "bg-emerald-100 text-emerald-800",
  soft: "bg-amber-100 text-amber-800",
  busy: "bg-red-100 text-red-700 line-through decoration-red-500 decoration-2",
  off: "text-muted-foreground/40",
};

/**
 * One member's month on paper (#126): their name in the corner, and every
 * day marked free, free only by giving something up, busy, or not searched.
 * Only whether a day is free for this event, never what is on it.
 *
 * `see` is how far the paper has turned see-through: 0 is plain paper; at 1
 * the sheet itself has gone and only its busy days are left, so a pile of
 * sheets shows every busy day at once over the days that shine through.
 */
export default function PaperSheet({
  sheet,
  label,
  month,
  lead,
  see,
  instant,
  through = false,
}: {
  /**
   * The base under the pile instead: no paper, and its free days (the ones
   * free for everyone) strong green, so they shine through once the sheets
   * above have turned see-through. Same grid, so every day lines up.
   */
  through?: boolean;
  sheet: PileSheet;
  /** The name in the corner: "Dig" on yours. */
  label: string;
  /** "Oktober 2026". */
  month: string;
  /** Empty cells before the 1st. */
  lead: number;
  see: number;
  /** Skipped or reduced motion: no fading. */
  instant: boolean;
}) {
  const { lang } = useLang();
  const fade = { duration: instant ? 0 : 0.6, ease: "easeOut" } as const;

  return (
    <div className="relative">
      {/* The paper: drawn apart from the marks, so it can fade on its own. */}
      {!through && (
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-xl border bg-card shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)]"
          animate={{ opacity: 1 - see }}
          transition={fade}
        />
      )}
      <div className="relative p-3">
        <motion.div
          className="mb-2 flex items-baseline justify-between"
          animate={{ opacity: 1 - see }}
          transition={fade}
        >
          <span className="text-[15px] font-extrabold text-foreground">{month}</span>
          <span className="max-w-[45%] truncate text-xs font-semibold text-muted-foreground">
            {label}
          </span>
        </motion.div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS[lang].map((d, i) => (
            <motion.span
              key={i}
              className="text-[11px] font-semibold text-muted-foreground"
              animate={{ opacity: 1 - see }}
              transition={fade}
            >
              {d}
            </motion.span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`lead-${i}`} />
          ))}
          {sheet.days.map((day, i) => (
            <motion.span
              key={i}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[13px] font-semibold",
                through
                  ? day === "free"
                    ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                    : "text-muted-foreground/40"
                  : MARK[day],
              )}
              // Seen through, only the busy days stay: everything else on this
              // sheet is just paper.
              animate={{ opacity: day === "busy" ? 1 : 1 - see }}
              transition={fade}
            >
              {i + 1}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
