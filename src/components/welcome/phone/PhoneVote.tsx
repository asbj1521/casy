import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Plus, RotateCcw } from "lucide-react";

import type { CandidateDate, EventResponse } from "@/api/events";
import CardFace from "@/components/swipe/deck/CardFace";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VoteEvent } from "@/lib/vote";
import { addDays, dayOfWeek, localDate } from "@/lib/zone";
import { EVENT_HOURS, TZ } from "./demo";
import { HEADER_PILL_TOP, SCREEN } from "./geometry";

/** Your own calendar under the card: empty that evening, so the card says nothing about a clash. */
const NO_CALENDAR = {
  segmentsOn: () => [],
  colorOf: () => "",
  labelOf: () => "",
} as unknown as MyCalendarDays;

const HOUR_PX = 62;
const FIRST_HOUR = EVENT_HOURS.from - 1;
const CARD_PX = 212;
const PANEL_PX = 316;
/** Where the day starts under the toolbar. */
const DAY_TOP = 106;

/** How each date is answered, in order: yes, no, yes. */
const ANSWERS: EventResponse[] = ["accepted", "declined", "accepted"];

/** The day gliding to the next date, as the home page's does when a date is answered (#176). */
const GLIDE = { duration: 0.5, ease: [0.32, 0.72, 0, 1] } as const;

/** One date's day: its week with the day marked, its name, the evening with the event pencilled in. */
function Day({ event, date }: { event: VoteEvent; date: CandidateDate }) {
  const t = useT();
  const { lang } = useLang();
  const at = Date.parse(date.start);
  const column = (dayOfWeek(at, TZ) + 6) % 7;
  const label = capitalize(
    new Date(date.start).toLocaleDateString(LOCALE[lang], {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: TZ,
    }),
  );
  return (
    <div className="absolute inset-0">
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="flex flex-col items-center gap-1">
            <span className="text-[12px] font-medium text-foreground">
              {t.weekdaysShort[(i + 1) % 7].charAt(0)}
            </span>
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[18px]",
                i === column ? "bg-foreground font-bold text-background" : "text-foreground",
              )}
            >
              {localDate(addDays(at, i - column, TZ), TZ).day}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-2 border-y border-border/70 py-2 text-center text-[15px] font-bold text-primary">
        {label}
      </div>
      <div className="relative mt-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="absolute inset-x-0" style={{ top: i * HOUR_PX }}>
            <span className="absolute left-2 top-[-8px] text-[12px] tabular-nums text-muted-foreground">
              {FIRST_HOUR + i}:00
            </span>
            <span className="absolute left-14 right-0 top-0 h-px bg-border/70" />
          </div>
        ))}
        <div
          className="absolute left-14 right-2 rounded-md border border-primary bg-primary/15 px-2 py-1"
          style={{
            top: HOUR_PX * (EVENT_HOURS.from - FIRST_HOUR),
            height: HOUR_PX * (EVENT_HOURS.to - EVENT_HOURS.from),
          }}
        >
          <div className="text-[14px] font-bold text-primary">{event.title}</div>
          <div className="text-[13px] text-primary">
            {formatTime(date.start)}-{formatTime(date.end)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Answering a vote on the phone (#228), as the home page does it (HomeVote over
 * DayView, #172, #176): the day of the date in question with the event
 * pencilled in, gliding on to the next date as each is answered, and over it
 * the panel with the title, one bar per date and the app's real card, thrown
 * the way its answer says, stamped. `answered` is how many dates are done. No
 * answer buttons: swiping is the point here, and the day gets their room.
 */
const PhoneVote = memo(function PhoneVote({
  event,
  answered,
}: {
  event: VoteEvent;
  answered: number;
}) {
  const t = useT();
  const { lang } = useLang();
  const dates = event.candidates;
  const index = Math.min(answered, dates.length - 1);
  const date = dates[index];
  const monthName = capitalize(
    new Date(date.start).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  return (
    <div className="absolute inset-0 bg-background">
      {/* The day, gliding sideways to the next date. */}
      <div
        className="absolute inset-x-0 overflow-hidden"
        style={{ top: DAY_TOP, height: SCREEN.height - DAY_TOP - PANEL_PX + 28 }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={date.id}
            className="absolute inset-0"
            initial={{ x: SCREEN.width }}
            animate={{ x: 0 }}
            exit={{ x: -SCREEN.width }}
            transition={GLIDE}
          >
            <Day event={event} date={date} />
          </motion.div>
        </AnimatePresence>
      </div>
      {/* The toolbar, as it is over a day. */}
      <div
        className="absolute inset-x-4 flex items-start justify-between"
        style={{ top: HEADER_PILL_TOP }}
      >
        <span
          className="glass-pill flex h-10 items-center rounded-full pl-2 pr-4 text-[17px] text-primary"
          style={{ backdropFilter: "none", WebkitBackdropFilter: "none" }}
        >
          <ChevronLeft className="h-6 w-6" />
          {monthName}
        </span>
        <span
          className="glass-pill flex h-10 items-center gap-3 rounded-full px-4 text-[17px] text-primary"
          style={{ backdropFilter: "none", WebkitBackdropFilter: "none" }}
        >
          <Plus className="h-5 w-5" />
          <span className="h-5 w-px bg-primary/30" />
          {t.calendarView.today}
        </span>
      </div>
      {/* The panel over it (HomeVote), the glass a solid tint: it moves with the phone. */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t bg-card/95 px-4 pb-5 pt-3 shadow-[0_-12px_40px_-14px_rgb(0_0_0/0.35)]"
        style={{ height: PANEL_PX }}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-foreground">{event.title}</p>
            <p className="truncate text-[13px] text-muted-foreground">{event.group.name}</p>
          </div>
          <RotateCcw className="h-5 w-5 text-amber-600 opacity-30" />
          <span className="px-2 text-[15px] font-semibold text-primary">{t.swipe.done}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {dates.map((d, i) => (
            <span
              key={d.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i === answered
                  ? "bg-foreground"
                  : i < answered
                    ? ANSWERS[i] === "accepted"
                      ? "bg-emerald-500"
                      : "bg-rose-400"
                    : "bg-secondary",
              )}
            />
          ))}
        </div>
        <div className="relative mt-3" style={{ height: CARD_PX }}>
          {dates[index + 1] && (
            <div className="absolute inset-0 translate-y-2 scale-[0.96] opacity-60">
              <CardFace
                event={event}
                date={dates[index + 1]}
                position={index + 2}
                total={dates.length}
                yours={undefined}
                calendar={NO_CALENDAR}
                clashes={[]}
                compact
              />
            </div>
          )}
          {answered >= dates.length && (
            <motion.p
              className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.2 }}
            >
              {t.swipe.doneTitle}
            </motion.p>
          )}
          <AnimatePresence initial={false} custom={ANSWERS[answered - 1]}>
            {answered < dates.length && (
              <motion.div
                key={date.id}
                className="absolute inset-0 z-10"
                custom={ANSWERS[answered - 1]}
                variants={{
                  // Solid from the start: see-through, the card under it would show in its text.
                  enter: { scale: 0.96, y: 8, opacity: 1 },
                  center: { scale: 1, y: 0, opacity: 1 },
                  exit: (to: EventResponse) => ({
                    x: to === "accepted" ? 640 : -640,
                    rotate: to === "accepted" ? 18 : -18,
                    opacity: 0,
                    transition: { duration: 0.42, ease: [0.3, 0, 0.8, 0.6] },
                  }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", damping: 26, stiffness: 300 }}
              >
                <CardFace
                  event={event}
                  date={date}
                  position={index + 1}
                  total={dates.length}
                  yours={undefined}
                  calendar={NO_CALENDAR}
                  clashes={[]}
                  compact
                />
                {/* The answer it goes with, stamped on as the real card does (SwipeCard). */}
                <motion.span
                  variants={{
                    enter: { opacity: 0 },
                    center: { opacity: 0 },
                    exit: { opacity: 1, transition: { duration: 0.08 } },
                  }}
                  className={cn(
                    "absolute top-6 rounded-lg border-[3px] px-2 py-0.5 text-[24px] font-extrabold uppercase tracking-wide",
                    ANSWERS[index] === "accepted"
                      ? "left-5 -rotate-12 border-emerald-500 text-emerald-600"
                      : "right-5 rotate-12 border-rose-500 text-rose-600",
                  )}
                >
                  {ANSWERS[index] === "accepted" ? t.swipe.can : t.swipe.cant}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

export default PhoneVote;
