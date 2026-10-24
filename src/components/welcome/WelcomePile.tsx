import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

import { MonthLayer } from "@/components/swipe/MonthView";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import type { GridItem } from "@/lib/monthGrid";
import { layerAlpha } from "@/lib/paperPile";
import { daysUntil } from "@/lib/scheduler";
import { addDays, dayOf, dayOfWeek, startOfMonth } from "@/lib/zone";
import Caption from "./pile/Caption";
import FitScale from "./pile/FitScale";
import Thrown from "./pile/Thrown";
import { DemoCard, DemoButtons } from "./pile/DemoCard";
import AddedToCalendars from "./pile/AddedToCalendars";
import { TZ, PILE, SWIPE_TIME, FRIENDS } from "./pile/demo";

/** You, in Apple Calendar's blue, busy on a few days; the three made-up friends are FRIENDS (pile/demo.ts). */
const YOU = { id: "you", color: "0, 122, 255", busy: [2, 3, 9, 10, 16, 17] };
/** The days of the month nobody above is busy on: what lights up and is suggested. */
const FREE = [7, 14, 21];
/** How Sara answers the three, one swipe each. */
const ANSWERS: ("accepted" | "declined")[] = ["accepted", "declined", "accepted"];
/** The others' answers on each card as Sara sees it: Nova and Erik answered before her. */
const OTHERS_ANSWERED: ("accepted" | "declined" | undefined)[][] = [
  ["accepted", "accepted"],
  ["accepted", undefined],
  [undefined, "accepted"],
];

const SHINE_HOLD = 1.4;
const CARD_HOLD = 0.8;
const SWIPE_GAP = 0.35;
/** Agreed, then "Tilføj til min kalender" pressed, then the event landing in everyone's calendar. */
const AGREED_TO_ADD = 1.8;
const ADD_TO_LANDED = 1.0;
/** Landed in everyone's calendar: it stays a while, so it reads as the end. */
const LANDED_HOLD = 2.4;
/** From the list appearing to its send button being pressed (the button shows at LIST_BUTTON). */
const LIST_TO_SEND = 3.0;
const LIST_BUTTON = 1.3;
/** From the press to the view panning after the dates to Sara's phone. */
const SEND_TO_PAN = 1.1;
const PAN = 0.6;

const AT = (() => {
  const pressed = PILE.pressAt;
  const shine = PILE.revealAt;
  const list = shine + SHINE_HOLD;
  const send = list + LIST_TO_SEND;
  const cards = send + SEND_TO_PAN;
  const swipes = [0, 1, 2].map((i) => cards + PAN + CARD_HOLD + i * (SWIPE_TIME + SWIPE_GAP));
  const agreed = swipes[2] + SWIPE_TIME + 0.35;
  const add = agreed + AGREED_TO_ADD;
  const landed = add + ADD_TO_LANDED;
  return {
    pressed,
    shine,
    list,
    send,
    cards,
    swipes,
    agreed,
    add,
    landed,
    end: landed + LANDED_HOLD,
  };
})();
const CYCLE_MS = Math.round((AT.end + 0.5) * 1000);

/** The moments in a round, in order: the picture changes at each. */
const STEPS = [
  0,
  AT.pressed,
  AT.shine,
  AT.list,
  AT.send,
  AT.cards,
  ...AT.swipes,
  AT.agreed,
  AT.add,
  AT.landed,
];
const PRESSED = 1;
const SHINE = 2;
const LIST = 3;
const SEND = 4;
const CARDS = 5;
const FIRST_SWIPE = 6;
const AGREED = 9;
const ADD = 10;
const LANDED = 11;

/**
 * The app's welcome screen picture (#151): how Casy plans, made up, in three
 * scenes with a caption each. Next month on your calendar ("Din kalender"),
 * three friends' calendars ("Saras kalender", ...) tossed onto it as Planlæg
 * throws them, pressed into line, the days free for everyone shining; the three
 * dates lifted out as a list; then the other side, Sara's phone, answering the
 * suggested dates on the real swipe card and buttons (yes, no, yes) until one
 * is agreed. Then it starts over. Still, on the list, under reduced motion.
 */
export default function WelcomePile() {
  const t = useT();
  const { lang } = useLang();
  const still = useReducedMotion() ?? false;
  const [round, setRound] = useState(0);
  const [stepIn, setStepIn] = useState<{ round: number; step: number }>({ round: 0, step: 0 });
  const step = still ? LIST : stepIn.round === round ? stepIn.step : 0;
  useEffect(() => {
    if (still) return;
    const timers = STEPS.slice(1).map((at, i) =>
      setTimeout(() => setStepIn({ round, step: i + 1 }), at * 1000),
    );
    timers.push(setTimeout(() => setRound((r) => r + 1), CYCLE_MS));
    return () => timers.forEach(clearTimeout);
  }, [round, still]);

  const [month] = useState(() => demoMonth(Date.now()));
  const [today] = useState(() => dayOf(new Date().toISOString(), TZ));
  const day = (d: number) => addDays(month, d - 1, TZ);
  const itemsOf = (who: { id: string; busy: number[] }): GridItem[] =>
    who.busy.map((d) => ({ calendarId: who.id, start: day(d), end: day(d + 1), label: "" }));
  const colors = useMemo(() => new Map([YOU, ...FRIENDS].map((w) => [w.id, w.color] as const)), []);
  const colorOf = (id: string) => colors.get(id) ?? "";
  const shine = useMemo(() => new Set(FREE.map((d) => addDays(month, d - 1, TZ))), [month]);
  const dateOf = (d: number) =>
    capitalize(
      new Date(day(d)).toLocaleDateString(LOCALE[lang], {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: TZ,
      }),
    );
  const inDays = (d: number) =>
    t.scheduler.inDays(daysUntil(dayOf(new Date(day(d)).toISOString(), TZ), today));
  const monthName = capitalize(
    new Date(month).toLocaleDateString(LOCALE[lang], { month: "long", timeZone: TZ }),
  );
  // The month's name at the top left and the weekdays under it, as a calendar has them.
  const heading = (
    <div className="px-4 pt-3">
      <div className="text-[20px] font-bold tracking-tight text-foreground">{monthName}</div>
      <div className="-mx-4 mt-1 grid grid-cols-7 pb-1 text-center text-[11px] font-medium">
        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
          <span key={dow} className={dow === 0 || dow === 6 ? "text-muted-foreground" : ""}>
            {t.weekdaysShort[dow].charAt(0)}
          </span>
        ))}
      </div>
    </div>
  );
  const pressed = step >= PRESSED;
  const owner = (label: string, color: string) => (
    <motion.span
      className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-foreground"
      animate={{ opacity: pressed ? 0 : 1 }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `rgb(${color})` }} />
      <span className="truncate">{label}</span>
    </motion.span>
  );
  const scene = step >= ADD ? "added" : step >= CARDS ? "swipe" : step >= LIST ? "list" : "pile";
  const alpha = layerAlpha(FRIENDS.length);
  // How many of Sara's swipes have begun: each card leaves as its swipe
  // begins, and the next rises to the top under it, as the real deck does,
  // waiting there for its own swipe.
  const started = step >= FIRST_SWIPE ? Math.min(FREE.length, step - FIRST_SWIPE + 1) : 0;

  return (
    <div aria-hidden className="pointer-events-none relative h-full">
      <motion.div
        key={round}
        className="absolute inset-0"
        animate={still ? undefined : { opacity: [1, 1, 0] }}
        transition={{ duration: CYCLE_MS / 1000, times: [0, 0.97, 1] }}
      >
        {/* Scenes 1 and 2: the calendars, fading out at the bottom under the
            text, then dimmed behind the dates. */}
        {/* Room all round inside the fade, so a calendar landing crooked is
            never clipped by it at the top or the sides. */}
        <motion.div
          className="absolute inset-x-0 bottom-0 top-0 px-4 pt-7"
          style={{
            maskImage: "linear-gradient(to bottom, black calc(100% - 80px), transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 80px), transparent)",
          }}
          animate={{
            // Panned away to the left after the dates, as Sara's phone comes in.
            x: step >= CARDS ? "-110%" : "0%",
            opacity: step >= LIST ? 0.3 : 1,
            scale: step >= LIST ? 0.96 : 1,
          }}
          transition={{ duration: step >= CARDS ? PAN : 0.5, ease: "easeInOut" }}
        >
          <FitScale>
            <div className="relative overflow-hidden rounded-[24px] border bg-card shadow-sm">
              <MonthLayer
                month={month}
                items={itemsOf(YOU)}
                colorOf={colorOf}
                lanes={1}
                heading={heading}
                owner={owner(t.welcome.yourCalendar, YOU.color)}
              />
            </div>
            {FRIENDS.map((friend, k) => (
              <Thrown key={friend.id} k={k} still={still} pressed={pressed}>
                <div
                  className="h-full rounded-[24px] border"
                  style={{
                    backgroundColor: `rgb(var(--glass-tint) / ${alpha})`,
                    borderColor: "rgb(var(--glass-edge))",
                    boxShadow:
                      "inset 0 1px 0 rgb(var(--glass-edge)), 0 18px 40px -18px rgb(0 0 0 / 0.45)",
                  }}
                >
                  <MonthLayer
                    month={month}
                    items={itemsOf(friend)}
                    colorOf={colorOf}
                    lanes={1}
                    heading={heading}
                    owner={owner(t.welcome.calendarOf(friend.name), friend.color)}
                  />
                </div>
              </Thrown>
            ))}
            {/* The days free for everyone, shining through the pile. */}
            <motion.div
              className="absolute inset-0 rounded-[24px] border border-transparent"
              initial={false}
              animate={{ opacity: step >= SHINE ? 1 : 0, scale: step >= SHINE ? 1 : 0.98 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <MonthLayer
                month={month}
                items={[]}
                colorOf={colorOf}
                shine={shine}
                lanes={1}
                // Takes the heading's room, so the days line up, without drawing it twice.
                heading={<div className="invisible">{heading}</div>}
              />
            </motion.div>
          </FitScale>
        </motion.div>

        {/* Scene 2: the dates, lifted out as a list, one after another; then
            sent for voting, as in Planlæg: the button pressed, the dates
            flying off to the right, the view panning after them. */}
        <AnimatePresence>
          {step >= LIST && step < CARDS && (
            <motion.div
              className="absolute inset-x-6 top-[35%] -translate-y-1/2"
              exit={{ x: "-110%", opacity: 0, transition: { duration: PAN, ease: "easeInOut" } }}
            >
              <ul className="space-y-2">
                {FREE.map((d, i) => (
                  <motion.li
                    key={d}
                    className="glass flex min-h-[88px] items-center gap-3.5 rounded-3xl px-5 py-3"
                    initial={still ? false : { opacity: 0, y: 28, scale: 0.94 }}
                    animate={
                      step >= SEND
                        ? { opacity: 0, x: 460, y: 0, scale: 1 }
                        : { opacity: 1, x: 0, y: 0, scale: 1 }
                    }
                    transition={
                      step >= SEND
                        ? { delay: 0.3 + i * 0.15, duration: 0.45, ease: [0.5, 0, 0.9, 0.4] }
                        : { delay: i * 0.35, type: "spring", stiffness: 220, damping: 24 }
                    }
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {dateOf(d)}
                      </span>
                      <span className="block text-[12px] text-muted-foreground">
                        {t.welcome.allCan(FRIENDS.length + 1)}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ul>
              {/* Planlæg's own send button, pressed. */}
              <motion.div
                className="mt-4 flex h-12 items-center justify-center rounded-full bg-cta text-[15px] font-bold text-white shadow-lg"
                initial={still ? false : { opacity: 0, y: 12 }}
                animate={
                  step >= SEND
                    ? { opacity: 1, y: 0, scale: [1, 0.92, 1] }
                    : { opacity: 1, y: 0, scale: 1 }
                }
                transition={
                  step >= SEND ? { duration: 0.3 } : { delay: LIST_BUTTON, duration: 0.35 }
                }
              >
                {t.planFromCalendar.suggest(FREE.length)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scene 3: the other side, Sara's phone, answering on the real card. */}
        {step >= CARDS && (
          <motion.div
            className="absolute inset-x-5 bottom-40 top-2 flex flex-col items-center justify-center"
            initial={{ x: "110%" }}
            animate={{ x: "0%" }}
            transition={{ duration: PAN, ease: "easeInOut" }}
          >
            <div
              className="relative min-h-0 w-full max-w-[320px] flex-1"
              style={{ maxHeight: 250 }}
            >
              {step < AGREED &&
                FREE.map((d, i) => (
                  <DemoCard
                    key={d}
                    depth={i - started}
                    answer={i < started ? ANSWERS[i] : null}
                    position={i + 1}
                    total={FREE.length}
                    date={dateOf(d)}
                    time={t.welcome.at("19:00")}
                    inDays={inDays(d)}
                    others={FRIENDS.slice(1).map((f, j) => ({
                      name: f.name,
                      answer: OTHERS_ANSWERED[i][j],
                    }))}
                  />
                ))}
              {step >= AGREED && (
                <motion.div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border bg-card p-5 text-center shadow-xl shadow-black/10"
                  initial={{ opacity: 0, scale: 0.9 }}
                  // Added: it gives a little as the event leaves it for the calendars below.
                  animate={
                    step >= ADD ? { opacity: 1, scale: [1, 0.96, 1] } : { opacity: 1, scale: 1 }
                  }
                  transition={
                    step >= ADD
                      ? { delay: 0.45, duration: 0.35 }
                      : { type: "spring", stiffness: 240, damping: 20 }
                  }
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-7 w-7" strokeWidth={3} />
                  </span>
                  <span className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-600">
                    {t.welcome.agreed}
                  </span>
                  <span className="mt-1 text-[22px] font-extrabold tracking-tight text-foreground">
                    {t.welcome.event}
                  </span>
                  <span className="text-[15px] text-muted-foreground">{dateOf(FREE[0])}</span>
                </motion.div>
              )}
            </div>
            {/* Under the card: the answer buttons while Sara answers; once
                agreed, "Tilføj til min kalender", and everyone's calendars. */}
            <div className="relative mt-3 h-[112px] w-full max-w-[320px] shrink-0">
              <DemoButtons hidden={step >= AGREED} />
              {step >= AGREED && (
                <AddedToCalendars
                  pressed={step >= ADD}
                  landed={step >= LANDED}
                  button={t.addToCalendar.button}
                  event={t.welcome.event}
                  day={new Date(day(FREE[0]))}
                  people={[t.welcome.you, ...FRIENDS.map((f) => f.name)]}
                />
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* What is happening, step by step, over the bottom of the picture. */}
      <Caption scene={scene} text={t.welcome.steps[scene]} />
    </div>
  );
}

/**
 * The example month: the first from next month whose 1st falls on a Thursday
 * or later, so the empty days before it have room to say whose calendar it is.
 */
function demoMonth(now: number): number {
  for (let n = 1; n <= 12; n++) {
    const month = startOfMonth(now, TZ, n);
    if ((dayOfWeek(month, TZ) + 6) % 7 >= 3) return month;
  }
  return startOfMonth(now, TZ, 1);
}
