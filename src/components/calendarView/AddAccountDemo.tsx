import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/** How long each screen of the path is on, the tap landing near its end. */
const STEP_MS = 1700;
/** The last screen, with the account picked, stays a little longer before it starts over. */
const LAST_MS = 2600;

/**
 * Adding a Google or Outlook account to the iPhone, shown rather than told
 * (#261): a small iPhone playing the way through Indstillinger on a loop, one
 * screen at a time, a finger tapping the row that leads on (Apps, Kalender,
 * Kalenderkonti, Tilføj konto, the account). The phone's calendars then hold
 * that account, and Casy reads them as any other on the phone. The rows are
 * iOS's own words (`path`), so what is seen here is what is found there.
 * Reduced motion shows the path as its names in a row. Decoration for screen
 * readers: the sentence under it (`spoken`, the caller's) says the same.
 */
export default function AddAccountDemo({ account }: { account: "google" | "outlook" }) {
  const t = useT();
  const words = t.phoneCalendar.addAccount;
  const reduce = useReducedMotion();
  // Each screen: its title, its rows, and which of them is tapped.
  const screens = [
    ...words.path.map((screen) => ({ ...screen })),
    { title: words.accounts.title, rows: words.accounts.rows, tap: words.accounts[account] },
  ];
  const [at, setAt] = useState(0);
  const last = at === screens.length - 1;
  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(
      () => setAt((i) => (i + 1) % screens.length),
      last ? LAST_MS : STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [at, last, reduce, screens.length]);

  if (reduce) {
    return (
      <p aria-hidden className="text-center text-[0.9375rem] font-semibold text-foreground">
        {screens.map((s) => s.tap).join("  ›  ")}
      </p>
    );
  }

  const screen = screens[at];
  return (
    <div aria-hidden className="mx-auto w-[13.5rem]">
      {/* The phone: a frame, the island, and the screen playing inside. */}
      <div className="relative h-[19rem] overflow-hidden rounded-[2.25rem] border-[6px] border-neutral-900 bg-secondary shadow-lg dark:border-neutral-700">
        <span className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-neutral-900 dark:bg-neutral-700" />
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={at}
            // iOS's own push: the next screen comes in from the right; the loop starts over with a fade.
            initial={at === 0 ? { opacity: 0 } : { x: "100%" }}
            animate={{ x: 0, opacity: 1 }}
            exit={at === 0 ? { opacity: 0 } : { x: "-30%", opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0 px-2.5 pt-9"
          >
            <div className="flex h-5 items-center">
              {at > 0 && <ChevronLeft className="h-4 w-4 text-sky-600" />}
            </div>
            <p className="px-1 text-[1.0625rem] font-bold leading-tight text-foreground">
              {screen.title}
            </p>
            <ul className="mt-2 overflow-hidden rounded-xl bg-card">
              {screen.rows.map((row) => {
                const tapped = row === screen.tap;
                return (
                  <li
                    key={row}
                    className="relative flex h-9 items-center justify-between border-b px-2.5 last:border-b-0"
                  >
                    {/* The tap: the row darkens as iOS's does, under a finger's touch. */}
                    {tapped && (
                      <motion.span
                        className="absolute inset-0 bg-foreground/10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0, 1, 1] }}
                        transition={{
                          duration: (last ? LAST_MS : STEP_MS) / 1000,
                          times: [0, 0.6, 0.72, 1],
                        }}
                      />
                    )}
                    <span
                      className={cn(
                        "relative truncate text-[0.8125rem] text-foreground",
                        tapped && "font-semibold",
                      )}
                    >
                      {row}
                    </span>
                    <ChevronRight className="relative h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {tapped && (
                      <motion.span
                        className="absolute right-7 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border-2 border-white bg-primary/70 shadow"
                        initial={{ opacity: 0, scale: 1.6 }}
                        animate={{ opacity: [0, 0, 1, 1], scale: [1.6, 1.6, 1, 0.85] }}
                        transition={{
                          duration: (last ? LAST_MS : STEP_MS) / 1000,
                          times: [0, 0.45, 0.65, 1],
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
