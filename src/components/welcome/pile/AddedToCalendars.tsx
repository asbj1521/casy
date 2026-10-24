import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { LOCALE, useLang } from "@/i18n/lang";
import { TZ } from "./demo";

/**
 * The end: "Tilføj til min kalender" (the real button) pressed, and the
 * event flying into everyone's calendar at once: a small Apple-style calendar
 * tile per person (the weekday in red, the day), each bumping and ticked as
 * it lands, so it reads as planned for everyone, not just you.
 */
export default function AddedToCalendars({
  pressed,
  landed,
  button,
  event,
  day,
  people,
}: {
  pressed: boolean;
  landed: boolean;
  button: string;
  event: string;
  day: Date;
  people: string[];
}) {
  const { lang } = useLang();
  const weekday = day
    .toLocaleDateString(LOCALE[lang], { weekday: "short", timeZone: TZ })
    .replace(/\.$/, "")
    .toUpperCase();
  const dayNumber = day
    .toLocaleDateString(LOCALE[lang], { day: "numeric", timeZone: TZ })
    .replace(/\.$/, "");
  return (
    <>
      <motion.div
        className="absolute inset-x-6 top-2 flex h-12 items-center justify-center rounded-full bg-cta text-[15px] font-bold text-white shadow-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={
          pressed
            ? { opacity: [1, 1, 0], y: 0, scale: [1, 0.92, 1] }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={
          pressed ? { duration: 0.5, times: [0, 0.6, 1] } : { delay: 0.6, duration: 0.35 }
        }
      >
        {button}
      </motion.div>
      {pressed && (
        <div className="absolute inset-0 grid grid-cols-4 items-end">
          {people.map((name, i) => (
            <motion.div
              key={name}
              className="relative flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }}
            >
              {/* The event, flying down from the card into this calendar. */}
              <motion.span
                className="absolute left-1/2 top-0 z-10 -translate-x-1/2 truncate rounded-md bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
                initial={{ opacity: 0, y: -150, x: `${(1.5 - i) * 85}%`, scale: 1 }}
                animate={
                  landed
                    ? { opacity: 0, y: 18, x: "0%", scale: 0.5 }
                    : { opacity: 1, y: -110, x: `${(1.5 - i) * 85}%`, scale: 1 }
                }
                transition={
                  landed
                    ? { duration: 0.45, delay: i * 0.05, ease: [0.5, 0, 0.9, 0.4] }
                    : { delay: 0.5, duration: 0.25 }
                }
              >
                {event}
              </motion.span>
              <motion.div
                className="relative flex h-14 w-14 flex-col items-center overflow-visible rounded-xl border bg-card pt-1 shadow-md"
                animate={landed ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={{ delay: 0.4 + i * 0.05, duration: 0.35 }}
              >
                <span className="text-[9px] font-bold leading-none text-red-500">{weekday}</span>
                <span className="text-[24px] font-light leading-tight text-foreground">
                  {dayNumber}
                </span>
                {landed && (
                  <motion.span
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.45 + i * 0.05,
                      type: "spring",
                      stiffness: 400,
                      damping: 18,
                    }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                )}
              </motion.div>
              <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground">
                {name}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
