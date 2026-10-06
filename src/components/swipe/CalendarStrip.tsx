import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2 } from "lucide-react";

import DayColumns from "@/components/swipe/DayColumns";
import { CONTENT_IN, MORPH } from "@/components/swipe/morph";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { useT } from "@/i18n/lang";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** The strip's height: about seven hours of the day, leaving the card its room. */
const STRIP_PX = 246;

/**
 * Your own calendar around a suggested date (#74), under its swipe card: the
 * day before, the day and the day after, drawn like Apple Calendar
 * (DayColumns) and opened on the suggested time. A tap grows it into the
 * same days on the whole screen (CalendarSheet, through the shared
 * `layoutId`), where you can look further; closing shrinks it back here
 * (`returning`), its contents fading in once it has its size again (see
 * morph.ts). While open, only its room is kept.
 */
export default function CalendarStrip({
  date,
  slotLabel,
  calendar,
  layoutId,
  open,
  returning,
  onOpen,
}: {
  date: { start: string; end: string };
  slotLabel: string;
  calendar: MyCalendarDays;
  layoutId: string;
  open: boolean;
  /** Shrinking back from the whole screen just now: the contents wait for the morph. */
  returning: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);

  if (calendar.none) {
    return (
      <p className="rounded-xl border bg-card px-3 py-2.5 text-sm text-muted-foreground">
        {t.swipe.noCalendar}{" "}
        <Link to="/calendar-overview/accounts" className="font-medium text-primary underline">
          {t.swipe.connect}
        </Link>
      </p>
    );
  }

  return (
    <div style={{ height: STRIP_PX }}>
      {!open && (
        <motion.div
          layoutId={reduceMotion ? undefined : layoutId}
          transition={MORPH}
          role="button"
          tabIndex={0}
          aria-label={t.swipe.openCalendar}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          className="relative z-30 h-full cursor-pointer overflow-hidden border bg-card shadow-sm"
          style={{ borderRadius: 14 }}
        >
          <motion.div
            className="h-full"
            initial={returning && !reduceMotion ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={CONTENT_IN}
          >
            <DayColumns
              home={startOfDay(start, TZ)}
              slot={{ start, end }}
              slotLabel={slotLabel}
              calendar={calendar}
              size="compact"
              // It opens: said in the corner, where the week number would be.
              corner={
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Maximize2 className="h-3 w-3" />
                </span>
              }
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
