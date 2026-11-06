import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

import Celebration from "@/components/swipe/Celebration";
import { useT } from "@/i18n/lang";
import type { OverviewCalendar } from "@/lib/calendarOverview";
import Notice from "@/components/ui/Notice";

/** How many cards the stack shows: enough to look like all of them. */
const FAN = 5;

/**
 * The reward (#221): every calendar gone through, thrown into one neat fan in
 * their colours, confetti, and what it did. If any failed to save, that is said
 * here, with a way to try again, rather than holding up each card on the way.
 */
export default function TourDone({
  calendars,
  colorOf,
  failed,
  onRetry,
}: {
  calendars: OverviewCalendar[];
  colorOf: (calendarId: string) => string;
  /** How many calendars could not be saved. */
  failed: number;
  onRetry: () => void;
}) {
  const t = useT();
  const words = t.calendarTour;
  const reduce = useReducedMotion();
  const fan = calendars.slice(0, FAN);
  const middle = (fan.length - 1) / 2;
  return (
    <div className="flex flex-col items-center px-2 pb-4 pt-6 text-center">
      {/* On the page itself: inside the sheet it would be cut to the sheet. */}
      {createPortal(<Celebration />, document.body)}
      <div aria-hidden className="relative h-36 w-full">
        {fan.map((c, i) => (
          <motion.div
            key={c.id}
            className="absolute left-1/2 top-2 h-28 w-20 rounded-2xl shadow-lg shadow-black/20"
            style={{ marginLeft: -40, backgroundColor: `rgb(${colorOf(c.id)})` }}
            initial={reduce ? false : { y: 90, rotate: 0, opacity: 0, scale: 0.8 }}
            animate={{
              y: Math.abs(i - middle) * 5,
              x: (i - middle) * 30,
              rotate: (i - middle) * 7,
              opacity: 1,
              scale: 1,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: i * 0.06 }}
          />
        ))}
      </div>
      <h3 className="mt-2 text-[1.5rem] font-extrabold tracking-tight text-foreground">
        {words.doneTitle}
      </h3>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">{words.doneBody}</p>
      {failed > 0 && (
        <Notice tone="error" className="mt-4 w-full text-left">
          {words.someFailed(failed)}{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            {words.retry}
          </button>
        </Notice>
      )}
    </div>
  );
}
