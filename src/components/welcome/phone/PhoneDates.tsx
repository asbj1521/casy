import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { useLang, useT } from "@/i18n/lang";
import { capitalize, dayLabel, formatTime } from "@/lib/format";
import type { VoteEvent } from "@/lib/vote";
import { dayCell, LIST, rowTop } from "./dayCell";
import { SCREEN } from "./geometry";

const LIST_WIDTH = SCREEN.width - LIST.left * 2;
/** The size of the green circle a date comes out of, as MonthSection draws it. */
const CIRCLE = 32;
/** The Aftaler button's middle on the phone's home page, where sent dates go (HomeBar). */
const AFTALER = { x: 40, y: SCREEN.height - 44 };

/**
 * The dates found, as Planlæg lists them (#228, DateList): the month scrolls
 * until a green circle is level with its row, the circle stretches into the
 * row, and so on. Then "Foreslå top 3 datoer" is pressed and the dates fly down
 * into the Aftaler button (sendFlightPlay). Solid rows, not glass: this all
 * moves with the phone, and a backdrop blur would be redrawn on every frame.
 */
export default function PhoneDates({
  event,
  days,
  month,
  taken,
  button,
  pressed,
  sent,
}: {
  event: VoteEvent;
  days: number[];
  month: number;
  /** How many dates have come out of their circles so far. */
  taken: number;
  button: boolean;
  pressed: boolean;
  sent: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  return (
    <div className="absolute inset-0">
      {days.map((day, i) => {
        if (i >= taken) return null;
        const top = rowTop(i);
        const cell = dayCell(day, month, lang);
        const date = event.candidates[i];
        return (
          <motion.div
            key={day}
            className="absolute overflow-hidden rounded-[22px] border bg-card shadow-lg shadow-black/10"
            style={{
              left: LIST.left,
              top,
              width: LIST_WIDTH,
              height: LIST.height,
              transformOrigin: "0 0",
            }}
            initial={{
              x: cell.x - CIRCLE / 2 - LIST.left,
              y: LIST.height / 2 - CIRCLE / 2,
              scaleX: CIRCLE / LIST_WIDTH,
              scaleY: CIRCLE / LIST.height,
            }}
            animate={
              sent
                ? {
                    x: AFTALER.x - LIST.left - (LIST_WIDTH * 0.08) / 2,
                    y: AFTALER.y - top - (LIST.height * 0.3) / 2,
                    scaleX: 0.08,
                    scaleY: 0.3,
                    opacity: [1, 1, 0],
                  }
                : { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }
            }
            transition={
              sent
                ? { delay: i * 0.1, duration: 0.62, ease: [0.45, 0, 0.3, 1] }
                : { duration: 0.55, ease: [0.3, 0.9, 0.3, 1] }
            }
          >
            {/* The green of the circle it came out of, fading into the row. */}
            <motion.div
              className="absolute inset-0 bg-emerald-500"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
            />
            <motion.div
              className="relative flex h-full items-center gap-3 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.25 }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta text-[12px] font-bold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold text-foreground">
                  {capitalize(dayLabel(new Date(day), lang))}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {formatTime(date.start)}-{formatTime(date.end)}
                </span>
              </span>
              <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={3} />
            </motion.div>
          </motion.div>
        );
      })}
      {button && (
        <motion.div
          className="glass-pill absolute flex h-14 items-center justify-center rounded-full text-[17px] font-bold text-primary"
          style={{
            left: LIST.left,
            right: LIST.left,
            top: rowTop(days.length) + 6,
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={
            sent
              ? { opacity: 0, y: 0, scale: 1 }
              : pressed
                ? { opacity: 1, y: 0, scale: [1, 0.93, 1] }
                : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: sent ? 0.2 : 0.32 }}
        >
          {t.planFromCalendar.suggest(days.length)}
        </motion.div>
      )}
    </div>
  );
}
