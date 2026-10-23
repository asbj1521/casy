import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Meh, X } from "lucide-react";

import { MonthLayer } from "@/components/swipe/MonthView";
import { AnswerIcon } from "@/components/swipe/SwipeCard";
import Avatar from "@/components/ui/Avatar";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { capitalize } from "@/lib/format";
import type { GridItem } from "@/lib/monthGrid";
import { layerAlpha, PILE_TIMING, pileTimeline, sheetTilt, throwSide } from "@/lib/paperPile";
import { daysUntil } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { addDays, APP_TIME_ZONE, dayOf, dayOfWeek, startOfMonth } from "@/lib/zone";

const TZ = APP_TIME_ZONE;

/** You and three made-up friends, in Apple Calendar's colours, each busy on a few days. */
const YOU = { id: "you", color: "0, 122, 255", busy: [2, 3, 9, 10, 16, 17] };
const FRIENDS = [
  { id: "sara", name: "Sara", color: "52, 199, 89", busy: [1, 4, 8, 11, 15, 18] },
  { id: "nova", name: "Nova", color: "175, 82, 222", busy: [3, 5, 10, 12, 17, 19] },
  { id: "erik", name: "Erik", color: "255, 149, 0", busy: [2, 6, 9, 13, 16, 20] },
];
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

/**
 * The throws are Planlæg's own (pileTimeline: each calendar quicker than the
 * one before); everything after holds long enough to take in, since someone
 * new is meant to understand what they see.
 */
const PILE = pileTimeline(FRIENDS.length);
const SHINE_HOLD = 1.4;
const CARD_HOLD = 1.1;
/** One swipe: the drag across with the stamp showing, then the throw off the screen. */
const DRAG = 0.7;
const FLING = 0.35;
const SWIPE_GAP = 0.7;
/** Agreed: it stays a while, so it reads as the end, before the round starts over. */
const AGREED_HOLD = 3.4;
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
  const swipes = [0, 1, 2].map((i) => cards + PAN + CARD_HOLD + i * (DRAG + FLING + SWIPE_GAP));
  const agreed = swipes[2] + DRAG + FLING + 0.5;
  return { pressed, shine, list, send, cards, swipes, agreed, end: agreed + AGREED_HOLD };
})();
const CYCLE_MS = Math.round((AT.end + 0.5) * 1000);

/** The moments in a round, in order: the picture changes at each. */
const STEPS = [0, AT.pressed, AT.shine, AT.list, AT.send, AT.cards, ...AT.swipes, AT.agreed];
const PRESSED = 1;
const SHINE = 2;
const LIST = 3;
const SEND = 4;
const CARDS = 5;
const FIRST_SWIPE = 6;
const AGREED = 9;

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
  const scene = step >= CARDS ? "swipe" : step >= LIST ? "list" : "pile";
  const alpha = layerAlpha(FRIENDS.length);
  // How many of Sara's swipes have begun: each card leaves as its swipe
  // begins, and the next rises to the top under it, as the real deck does,
  // waiting there for its own swipe.
  const started = step >= FIRST_SWIPE ? Math.min(FREE.length, step - FIRST_SWIPE + 1) : 0;
  const swiping = step >= FIRST_SWIPE && step < AGREED ? started - 1 : null;

  return (
    <div aria-hidden className="pointer-events-none flex h-full flex-col">
      <Caption scene={scene} text={t.welcome.steps[scene]} />

      <motion.div
        key={round}
        className="relative min-h-0 flex-1"
        animate={still ? undefined : { opacity: [1, 1, 0] }}
        transition={{ duration: CYCLE_MS / 1000, times: [0, 0.97, 1] }}
      >
        {/* Scenes 1 and 2: the calendars, fading out at the bottom under the
            text, then dimmed behind the dates. */}
        <motion.div
          className="absolute inset-x-3 bottom-0 top-2"
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
              className="absolute inset-x-6 top-[42%] -translate-y-1/2"
              exit={{ x: "-110%", opacity: 0, transition: { duration: PAN, ease: "easeInOut" } }}
            >
              <ul className="space-y-2">
                {FREE.map((d, i) => (
                  <motion.li
                    key={d}
                    className="glass flex items-center gap-3 rounded-2xl px-4 py-3"
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
            className="absolute inset-x-5 bottom-10 top-1 flex flex-col items-center"
            initial={{ x: "110%" }}
            animate={{ x: "0%" }}
            transition={{ duration: PAN, ease: "easeInOut" }}
          >
            <span className="glass mb-3 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold text-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `rgb(${FRIENDS[0].color})` }}
              />
              {t.welcome.phoneOf(FRIENDS[0].name)}
            </span>
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
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 20 }}
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
            <DemoButtons
              pressing={swiping !== null ? ANSWERS[swiping] : null}
              hidden={step >= AGREED}
            />
          </motion.div>
        )}
      </motion.div>
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

/** The scene's caption, numbered, swapping as the scenes change. */
function Caption({ scene, text }: { scene: "pile" | "list" | "swipe"; text: string }) {
  const n = { pile: 1, list: 2, swipe: 3 }[scene];
  return (
    <div className="flex h-10 shrink-0 items-center justify-center px-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={scene}
          className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-semibold text-foreground"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25 }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
            {n}
          </span>
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/**
 * Its content scaled down to fit the space it is given, never up: the whole
 * month shows whatever the phone's height.
 */
function FitScale({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const fit = () =>
      setScale(Math.min(1, b.clientHeight / i.offsetHeight, b.clientWidth / i.offsetWidth));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(b);
    observer.observe(i);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="relative h-full w-full">
      <div
        ref={inner}
        className="absolute left-1/2 top-0 w-full max-w-[380px]"
        style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * One friend's calendar thrown onto the pile as Planlæg throws it, on its
 * timeline (PileScreen's ThrownLayer, simplified): from high above and to the
 * side, falling faster into the hit, a small skid and hop, settling crooked;
 * pressed, straight into line without a bounce.
 */
function Thrown({
  k,
  still,
  pressed,
  children,
}: {
  k: number;
  still: boolean;
  pressed: boolean;
  children: ReactNode;
}) {
  const land = PILE.lands[k];
  const tilt = sheetTilt(k + 1);
  const side = throwSide(k);
  const from = side * 220;
  const hit = land.duration / (land.duration + PILE_TIMING.impact);
  return (
    <motion.div
      className="absolute inset-0"
      style={{ transformOrigin: "50% 35%" }}
      initial={still ? false : { x: from, y: -160, rotate: side * -14, scale: 1.6, opacity: 0 }}
      animate={
        pressed
          ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
          : {
              x: [from, tilt.x - side * 7, tilt.x + side * 2, tilt.x],
              y: [-160, tilt.y + 3, tilt.y - 8, tilt.y],
              rotate: [side * -14, tilt.rotate - side * 1.5, tilt.rotate + side * 0.6, tilt.rotate],
              scale: [1.6, 0.975, 1.012, 1],
              opacity: [0, 1, 1, 1],
            }
      }
      transition={
        pressed
          ? { type: "spring", stiffness: 170, damping: 26 }
          : {
              delay: land.at,
              duration: land.duration + PILE_TIMING.impact,
              times: [0, hit, hit + (1 - hit) * 0.4, 1],
              ease: [[0.55, 0, 1, 0.45], "easeOut", "easeInOut"],
            }
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * A suggested date on Sara's phone, drawn as the swipe screen's card
 * (DateDeck's CardFace and SwipeCard's stamps): "Dato 1 af 3", the date, the
 * time, how soon, and the others' answers so far. Stacked under the one being
 * answered (`depth`); answered, it is dragged across with its stamp showing,
 * then thrown off the screen, right for can and left for can't.
 */
function DemoCard({
  depth,
  answer,
  position,
  total,
  date,
  time,
  inDays,
  others,
}: {
  depth: number;
  answer: "accepted" | "declined" | null;
  position: number;
  total: number;
  date: string;
  time: string;
  inDays: string;
  others: { name: string; answer: "accepted" | "declined" | undefined }[];
}) {
  const t = useT();
  const right = answer === "accepted";
  const dir = right ? 1 : -1;
  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - depth }}
      initial={false}
      animate={
        answer
          ? {
              x: [0, dir * 120, dir * 640],
              rotate: [0, dir * 8, dir * 18],
              opacity: [1, 1, 0],
            }
          : { x: 0, rotate: 0, y: depth * 10, scale: 1 - depth * 0.04, opacity: depth > 1 ? 0 : 1 }
      }
      transition={
        answer
          ? { duration: DRAG + FLING, times: [0, DRAG / (DRAG + FLING), 1], ease: "easeInOut" }
          : { type: "spring", stiffness: 300, damping: 26 }
      }
    >
      <div className="flex h-full flex-col rounded-3xl border bg-card p-5 shadow-xl shadow-black/10">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {t.swipe.dateOf(position, total)}
        </p>
        <p className="mt-2 text-[26px] font-extrabold leading-[1.1] tracking-tight text-foreground">
          {date}
        </p>
        <p className="mt-1 text-lg text-foreground">{time}</p>
        <p className="text-sm text-muted-foreground">{inDays}</p>
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {others.map((p, i) => (
            <li
              key={p.name}
              className={cn(
                "flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs",
                p.answer === "accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                p.answer === "declined" && "border-rose-200 bg-rose-50 text-rose-800",
                !p.answer && "bg-background text-muted-foreground",
              )}
            >
              <Avatar name={p.name} index={i + 1} size="xs" />
              {p.name}
              <AnswerIcon answer={p.answer} />
            </li>
          ))}
        </ul>
      </div>
      {/* The answer it is heading for, stamped on as the real card does. */}
      {answer && (
        <motion.span
          className={cn(
            "absolute top-6 rounded-lg border-[3px] px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide",
            right
              ? "left-5 -rotate-12 border-emerald-500 text-emerald-600"
              : "right-5 rotate-12 border-rose-500 text-rose-600",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DRAG * 0.6 }}
        >
          {right ? t.swipe.can : t.swipe.cant}
        </motion.span>
      )}
    </motion.div>
  );
}

/**
 * The swipe screen's three answer buttons (SwipeCard's AnswerButtons, drawn
 * here without their handlers): the one matching the answer being given
 * presses in as the card goes.
 */
function DemoButtons({
  pressing,
  hidden,
}: {
  pressing: "accepted" | "declined" | null;
  hidden: boolean;
}) {
  const t = useT();
  const base = "flex items-center justify-center rounded-full border-2 bg-card shadow-md";
  const buttons = [
    ["declined", X, "h-14 w-14 border-rose-200 text-rose-600", "h-7 w-7", t.swipe.cant],
    ["maybe", Meh, "mt-2 h-11 w-11 border-amber-200 text-amber-600", "h-5 w-5", t.swipe.rather],
    ["accepted", Check, "h-14 w-14 border-emerald-200 text-emerald-600", "h-7 w-7", t.swipe.can],
  ] as const;
  return (
    <motion.div
      className="flex shrink-0 items-start justify-center gap-6 pt-3"
      animate={{ opacity: hidden ? 0 : 1 }}
    >
      {buttons.map(([response, Icon, size, iconSize, label]) => (
        <div key={response} className="flex flex-col items-center gap-1">
          <motion.span
            className={cn(base, size)}
            animate={pressing === response ? { scale: [1, 0.86, 1] } : { scale: 1 }}
            transition={{ duration: 0.35 }}
          >
            <Icon className={iconSize} strokeWidth={2.5} />
          </motion.span>
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
    </motion.div>
  );
}
