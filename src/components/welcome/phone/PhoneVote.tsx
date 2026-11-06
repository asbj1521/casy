import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Plus, RotateCcw } from "lucide-react";

import type { EventResponse } from "@/api/events";
import { AnswerButtons } from "@/components/swipe/SwipeCard";
import CardFace from "@/components/swipe/deck/CardFace";
import type { MyCalendarDays } from "@/hooks/useMyCalendarDays";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VoteEvent } from "@/lib/vote";
import { addDays, dayOfWeek, localDate } from "@/lib/zone";
import { EVENT_HOURS, TZ } from "./demo";
import { HEADER_PILL_TOP } from "./geometry";

/** Your own calendar under the card: empty that evening, so the card says nothing about a clash. */
const NO_CALENDAR = {
  segmentsOn: () => [],
  colorOf: () => "",
  labelOf: () => "",
} as unknown as MyCalendarDays;

const HOUR_PX = 52;
const FIRST_HOUR = EVENT_HOURS.from - 1;

/** How each date is answered, in order: yes, no, yes. */
const ANSWERS: EventResponse[] = ["accepted", "declined", "accepted"];

/**
 * Answering a vote on the phone (#228), as the home page does it (HomeVote over
 * DayView, #172, #176): the day of the date in question with the event
 * pencilled in, and over it the glass panel with the title, one bar per date,
 * the app's real card and answer buttons. `answered` is how many dates are
 * done; each card goes the way its answer says, stamped, and the day above
 * moves on to the next date.
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
  const dayStart = useMemo(() => {
    const at = Date.parse(date.start);
    // This week's Monday, from the date itself: through the zone, never by adding ms.
    return addDays(at, -((dayOfWeek(at, TZ) + 6) % 7), TZ);
  }, [date.start]);
  const week = Array.from({ length: 7 }, (_, i) => addDays(dayStart, i, TZ));
  const label = capitalize(
    new Date(date.start).toLocaleDateString(LOCALE[lang], {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: TZ,
    }),
  );
  const monthName = capitalize(
    new Date(date.start).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  return (
    <div className="absolute inset-0 bg-background">
      {/* The toolbar, as it is over a day. */}
      <div
        className="absolute inset-x-4 flex items-start justify-between"
        style={{ top: HEADER_PILL_TOP }}
      >
        <span
          className="glass-pill flex h-10 items-center rounded-full px-4 text-[17px] text-primary"
          style={{ backdropFilter: "none", WebkitBackdropFilter: "none" }}
        >
          <ChevronLeft className="-ml-1 h-6 w-6" />
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
      {/* The week, its selected day marked. */}
      <div className="absolute inset-x-0 grid grid-cols-7 text-center" style={{ top: 112 }}>
        {week.map((d, i) => {
          const selected = i === (dayOfWeek(Date.parse(date.start), TZ) + 6) % 7;
          return (
            <span key={d} className="flex flex-col items-center gap-1">
              <span className="text-[12px] font-medium text-foreground">
                {t.weekdaysShort[(i + 1) % 7].charAt(0)}
              </span>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-[18px]",
                  selected ? "bg-foreground font-bold text-background" : "text-foreground",
                )}
              >
                {localDate(d, TZ).day}
              </span>
            </span>
          );
        })}
      </div>
      <div
        className="absolute inset-x-0 border-y border-border/70 py-2 text-center text-[15px] font-bold text-primary"
        style={{ top: 178 }}
      >
        {label}
      </div>
      {/* The evening, with the event pencilled in. */}
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: 217, height: 210 }}>
        {[0, 1, 2, 3, 4].map((i) => (
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
      {/* The panel over it (HomeVote), the glass a solid tint: it moves with the phone. */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t bg-card/95 px-4 pb-5 pt-3 shadow-[0_-12px_40px_-14px_rgb(0_0_0/0.35)]"
        style={{ height: 430 }}
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
        <div className="relative mt-3" style={{ height: 236 }}>
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
                    transition: { duration: 0.38, ease: [0.3, 0, 0.8, 0.6] },
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
        <AnswerButtons onAnswer={() => {}} screen tight />
      </div>
    </div>
  );
});

export default PhoneVote;
