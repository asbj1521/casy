import { useLayoutEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Columns2, Layers, Plus, RectangleVertical } from "lucide-react";

import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/** The morph's pace: Apple's soft stop, quick enough to keep up with the zoom. */
const MORPH = { type: "spring", damping: 34, stiffness: 420, mass: 0.7 } as const;

/**
 * The home page's toolbar (#180), one for the month and the day view alike,
 * so its buttons never move as a day opens: they stay where they are while
 * the day grows in under them, and morph into their use there. "Kalendere"
 * becomes "‹ <month>", its words crossfading as the pill's width follows;
 * the capsule on the right takes the 1/2-day switch in on its left, so the
 * plus and "I dag" stay put. Fixed where the month's own toolbar row is
 * (`at`, the stand-in MonthView's header keeps), above the month and the
 * day view.
 */
export default function HomeToolbar({
  at,
  day,
  monthLabel,
  span,
  onSpan,
  listRef,
  listOpen,
  onList,
  onBack,
  tellRef,
  tellLabel,
  onTell,
  onToday,
}: {
  /** The stand-in row on the month the toolbar sits over. */
  at: RefObject<HTMLElement | null>;
  /** The day view's buttons, not the month's. */
  day: boolean;
  /** The day view's month, for "‹ Oktober". */
  monthLabel: string;
  span: 1 | 2;
  onSpan: () => void;
  listRef: RefObject<HTMLButtonElement | null>;
  /** The calendars' sheet is open, grown out of the button, which stands aside. */
  listOpen: boolean;
  onList: () => void;
  onBack: () => void;
  tellRef: RefObject<HTMLButtonElement | null>;
  tellLabel: string;
  onTell?: () => void;
  onToday: () => void;
}) {
  const t = useT();
  const words = t.calendarView;
  const reduce = useReducedMotion();
  const move = reduce ? { duration: 0 } : MORPH;

  // Where the stand-in is, measured, as it moves with the header's notices.
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = at.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      setPlace({ top: box.top, left: box.left, width: box.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [at]);
  if (!place) return null;

  return (
    <div
      className="fixed z-[41] flex items-start justify-between px-4"
      style={{ top: place.top, left: place.left, width: place.width }}
    >
      <motion.button
        ref={listRef}
        layout
        transition={move}
        type="button"
        onClick={day ? onBack : onList}
        aria-label={day ? t.swipe.showMonth(monthLabel) : undefined}
        // Its sheet drops out of it from the top (#169), standing in for it.
        className={cn(
          "glass-pill flex h-10 items-center overflow-hidden rounded-full text-[17px] text-primary transition-opacity duration-200",
          day ? "gap-0.5 pl-2 pr-4" : "gap-1.5 pl-3.5 pr-4",
          listOpen && !day && "opacity-0",
        )}
        style={{ borderRadius: 9999 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={day ? `day-${monthLabel}` : "month"}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
            className="flex items-center gap-[inherit] whitespace-nowrap"
          >
            {day ? <ChevronLeft className="h-6 w-6" /> : <Layers className="h-5 w-5" />}
            {day ? monthLabel : words.calendarsButton}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* One capsule round everything on the right; the switch slides in on its left. */}
      <div className="glass-pill flex h-10 items-center overflow-hidden rounded-full text-primary">
        <AnimatePresence initial={false}>
          {day && (
            <motion.span
              key="span"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={move}
              className="flex items-center overflow-hidden"
            >
              <button
                type="button"
                onClick={onSpan}
                aria-label={span === 1 ? words.showTwoDays : words.showOneDay}
                className="flex h-10 w-12 shrink-0 items-center justify-center rounded-l-full"
              >
                {span === 1 ? (
                  <RectangleVertical className="h-5 w-5" />
                ) : (
                  <Columns2 className="h-5 w-5" />
                )}
              </button>
              <span aria-hidden className="h-5 w-px shrink-0 bg-primary/30" />
            </motion.span>
          )}
        </AnimatePresence>
        {/* Tell Casy (#116): the plus, left of "I dag". */}
        {onTell && (
          <>
            <button
              ref={tellRef}
              type="button"
              onClick={onTell}
              aria-label={tellLabel}
              title={tellLabel}
              className={cn("flex h-10 w-11 items-center justify-center", !day && "rounded-l-full")}
            >
              <Plus className="h-6 w-6" strokeWidth={2.25} />
            </button>
            <span aria-hidden className="h-5 w-px bg-primary/30" />
          </>
        )}
        <button
          type="button"
          onClick={onToday}
          className="flex h-10 items-center rounded-full px-4 text-[17px]"
        >
          {words.today}
        </button>
      </div>
    </div>
  );
}
