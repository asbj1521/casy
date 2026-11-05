import { motion, useReducedMotion } from "framer-motion";

import { useT } from "@/i18n/lang";

/** Seconds round the loop: three events across, then a moment to read the result. */
const LOOP = 6.5;
/** A row's own width as the way across: the columns are 46% wide, the second starting at 54%. */
const ACROSS = `${(54 / 46) * 100}%`;
const ROW = "absolute inset-x-0 flex h-7 items-center gap-2 overflow-hidden rounded-lg px-2.5";
const rowTop = (i: number) => ({ top: `${i * 2}rem` });

/**
 * What the import sheet promises, shown (#215): the events on your phone, and
 * what Casy gets of them. Each lifts off the phone's side with its name, loses
 * the name on the way over, and lands on Casy's side as a time and nothing
 * else. Only transform and opacity move, and it all goes when the sheet does.
 * Reduced motion shows where it ends. Decoration for screen readers: the
 * sentence under it says the same.
 */
export default function OnlyTimesDemo() {
  const t = useT();
  const words = t.phoneCalendar.demo;
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="mb-4 px-1">
      <div className="flex justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="w-[46%]">{words.phone}</span>
        <span className="w-[46%]">{words.casy}</span>
      </div>
      <div className="relative mt-1.5 h-[5.75rem]">
        {/* The phone's side stays as it was: nothing leaves it but a copy. */}
        <div className="absolute inset-y-0 left-0 w-[46%]">
          {words.events.map((event, i) => (
            <div key={event.time} className={`${ROW} bg-secondary`} style={rowTop(i)}>
              <span className="shrink-0 text-[13px] font-semibold text-foreground">
                {event.time}
              </span>
              <span className="truncate text-[13px] text-foreground">{event.title}</span>
            </div>
          ))}
        </div>
        {/* Casy's side, empty until they land. */}
        <div className="absolute inset-y-0 right-0 w-[46%]">
          {words.events.map((event, i) => (
            <div
              key={event.time}
              className={`${ROW} ${reduce ? "bg-primary/15" : "border border-dashed border-border"}`}
              style={rowTop(i)}
            >
              {reduce && (
                <span className="text-[13px] font-semibold text-foreground">{event.time}</span>
              )}
            </div>
          ))}
        </div>
        {!reduce &&
          words.events.map((event, i) => <Flying key={event.time} event={event} index={i} />)}
      </div>
    </div>
  );
}

/** One event's way across, on a clock shared with the others. */
function Flying({ event, index }: { event: { time: string; title: string }; index: number }) {
  // In fractions of the loop: when it lifts off, and when it has landed.
  const off = 0.06 + index * 0.22;
  const on = off + 0.16;
  const clock = { duration: LOOP, repeat: Infinity, ease: "easeInOut" } as const;
  return (
    <motion.div
      className="absolute inset-y-0 left-0 w-[46%]"
      initial={{ x: "0%", opacity: 0 }}
      animate={{
        x: ["0%", "0%", "0%", ACROSS, ACROSS, ACROSS, "0%"],
        opacity: [0, 0, 1, 1, 1, 0, 0],
      }}
      transition={{ ...clock, times: [0, off - 0.02, off, on, 0.92, 0.97, 1] }}
    >
      <div className={`${ROW} bg-secondary shadow-sm`} style={rowTop(index)}>
        {/* Its colour turns to Casy's as it arrives. */}
        <motion.span
          className="absolute inset-0 bg-primary/15"
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ ...clock, times: [0, off + 0.06, on, 0.97, 1] }}
        />
        <span className="relative shrink-0 text-[13px] font-semibold text-foreground">
          {event.time}
        </span>
        {/* The name goes on the way: this is the point of it all. */}
        <motion.span
          className="relative truncate text-[13px] text-foreground"
          animate={{ opacity: [1, 1, 0, 0, 1] }}
          transition={{ ...clock, times: [0, off + 0.02, off + 0.1, 0.97, 1] }}
        >
          {event.title}
        </motion.span>
      </div>
    </motion.div>
  );
}
