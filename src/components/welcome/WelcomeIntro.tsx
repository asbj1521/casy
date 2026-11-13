import { useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

import type { MorphRect } from "@/components/welcome/phone/morph";
import LogoMark from "@/components/ui/LogoMark";
import { APP_NAME } from "@/i18n/brand";
import { useLang } from "@/i18n/lang";

const WORDS = {
  relate: { da: "Vi kender det alle:", en: "We all know this one:" },
  verdict: {
    da: "Alle ved det ik bliver til noget...",
    en: "Everyone knows it won't happen...",
  },
  turn: { da: "Men nu gør det!", en: "But now it will!" },
  present: { da: "Introducerer:", en: "Introducing:" },
  reply: { da: "Næste gang, svar med den her.", en: "Next time, reply with this." },
  /** The friend's first message, soon replaced by the second. */
  first: { da: "Det lyder SÅ sjovt!", en: "That sounds SO fun!" },
  /** The catchphrase, alone on the screen: the message that grows old. */
  message: { da: "Vi finder lige en dag 😍", en: "We'll find a day 😍" },
  sent: { da: "Sendt 12. mar.", en: "Sent 12 Mar" },
  now: { da: "nu", en: "now" },
  months: {
    da: [
      "apr.",
      "maj",
      "jun.",
      "jul.",
      "aug.",
      "sep.",
      "okt.",
      "nov.",
      "dec.",
      "jan.",
      "feb.",
      "mar.",
    ],
    en: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
  },
  linkDetail: { da: "Find en dag · App Store", en: "Find a day · App Store" },
};

/** When each part starts, in ms from the intro's start. */
const AT = {
  up: 1300,
  bubble: 1800,
  /** The catchphrase takes the first message's place. */
  second: 3400,
  aging: 5000,
  /** The timeline, racing by now, fades away. */
  fade: 7700,
  /** "Alle ved det ik…", alone in the middle: it goes there as it appears. */
  verdict: 8100,
  /** "Men nu gør det!" */
  turn: 11400,
  /** "Introducerer:", and the app's icon pops up, big, with its name. */
  present: 12900,
  /** Up again with "Næste gang, svar med den her.", the old message back beside it; the icon
   * flies off, shrinking, to where the link lands. */
  back: 15100,
  /** The link pressed, as a finger would. */
  tap: 17400,
  zoom: 17850,
};
/** How long the message takes to grow old, in s. */
const AGE_S = 2.7;
/** How long the timeline runs, faster and faster: past its fading, so it never slows. */
const RUN_S = 3.2;
/** How fast the friend's message types itself, per letter. */
const TYPE_MS = 45;
/** The timeline's months, apart. */
const MONTH_PX = 64;
/** The icon opening into the link: an even ease in and out, so it never seems to jump. */
const OPEN = { duration: 0.9, ease: [0.65, 0, 0.35, 1] } as const;

/** One thread of a web, a crack or anything drawn as age comes on, between two moments of it. */
function Grows({
  d,
  age,
  from,
  to,
  stroke,
  width,
}: {
  d: string;
  age: MotionValue<number>;
  from: number;
  to: number;
  stroke: string;
  width: number;
}) {
  const pathLength = useTransform(age, [from, to], [0, 1]);
  return (
    <motion.path
      d={d}
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
      style={{ pathLength }}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** A cobweb in a corner, spun thread by thread as the message ages. */
function Cobweb({
  age,
  start,
  className,
}: {
  age: MotionValue<number>;
  start: number;
  className: string;
}) {
  const angles = [0, 22, 45, 68, 90].map((deg) => (deg * Math.PI) / 180);
  const spokes = angles.map(
    (r) => `M0 0 L${(Math.cos(r) * 60).toFixed(1)} ${(Math.sin(r) * 60).toFixed(1)}`,
  );
  // Each ring sags a little between its spokes, as old threads do.
  const rings = [16, 28, 40, 52].map((d) => {
    const pt = (r: number, k = 1) =>
      `${(Math.cos(r) * d * k).toFixed(1)} ${(Math.sin(r) * d * k).toFixed(1)}`;
    let path = `M${pt(angles[0])}`;
    for (let i = 1; i < angles.length; i++) {
      path += ` Q${pt((angles[i - 1] + angles[i]) / 2, 0.86)} ${pt(angles[i])}`;
    }
    return path;
  });
  const threads = [...spokes, ...rings];
  const span = (1 - start) / threads.length;
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      {threads.map((d, i) => (
        <Grows
          key={d}
          d={d}
          age={age}
          from={start + i * span * 0.8}
          to={start + (i + 1) * span * 0.8 + 0.08}
          stroke="rgb(255 255 255 / 0.9)"
          width={1}
        />
      ))}
    </svg>
  );
}

/** The cracks across the bubble, in its own share of width and height, each with when it starts. */
const CRACKS: [string, number][] = [
  ["M8 0 L12 9 L9 16 L15 26 L13 34", 0.18],
  ["M62 50 L58 40 L63 31 L57 22", 0.32],
  ["M12 9 L22 11 L28 7", 0.42],
  ["M58 40 L70 42 L76 37 L84 41", 0.5],
  ["M92 0 L88 8 L91 14", 0.6],
  ["M9 16 L4 20", 0.68],
  ["M63 31 L72 27", 0.74],
];

/** The friend's message: typed, then old, cracked, mossy, spun over and unreadable. */
function AgingBubble({
  text,
  typed,
  age,
}: {
  text: string;
  typed: number;
  age: MotionValue<number>;
}) {
  const background = useTransform(age, [0, 1], ["#EFEFF1", "#D6CDB6"]);
  const words = useTransform(age, [0.15, 0.9], [1, 0.45]);
  const rotate = useTransform(age, [0, 1], [0, -3.5]);
  const y = useTransform(age, [0, 1], [0, 10]);
  return (
    <motion.div className="relative max-w-[82%] self-start" style={{ rotate, y }}>
      <motion.span
        className="relative block overflow-hidden rounded-[22px] rounded-bl-[6px] px-4 py-3 text-[1.1875rem] leading-snug text-[#1c1c1e]"
        style={{ background }}
      >
        {/* The whole text holds the bubble's size; what is typed shows over it. */}
        <span className="invisible">{text}</span>
        <motion.span className="absolute inset-0 px-4 py-3" style={{ opacity: words }}>
          {text.slice(0, typed)}
          {typed < text.length && (
            <motion.span
              className="ml-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-[#1c1c1e]"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </motion.span>
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
        >
          {CRACKS.map(([d, start]) => (
            <Grows
              key={d}
              d={d}
              age={age}
              from={start}
              to={start + 0.22}
              stroke="rgb(60 50 35 / 0.7)"
              width={1.4}
            />
          ))}
        </svg>
      </motion.span>
      <Cobweb age={age} start={0.05} className="absolute -left-3 -top-4 h-16 w-16" />
      <Cobweb age={age} start={0.4} className="absolute -bottom-4 -right-3 h-14 w-14 rotate-180" />
    </motion.div>
  );
}

/**
 * Time going by, under the message: the day it was sent, then the months
 * running past towards now, on and on.
 */
function Timeline({ lang, run }: { lang: "da" | "en"; run: boolean }) {
  const months = Array.from({ length: 4 }, () => WORDS.months[lang]).flat();
  return (
    <div className="relative mt-8 h-14 overflow-hidden" aria-hidden>
      <span className="absolute inset-x-0 top-[5px] h-[2px] bg-white/50" />
      {/* The months run out of sight just before "now", which they never reach. */}
      <div
        className="absolute inset-y-0 left-0 right-14 overflow-hidden"
        style={{ maskImage: "linear-gradient(to right, black 85%, transparent)" }}
      >
        <motion.div
          className="absolute left-0 top-0 flex items-start"
          initial={{ x: 24 }}
          animate={run ? { x: 24 - months.length * MONTH_PX + 220 } : { x: 24 }}
          // Ever faster, like years flying by.
          transition={{ duration: RUN_S, ease: [0.55, 0, 1, 1] }}
        >
          <span className="flex shrink-0 flex-col items-start" style={{ width: MONTH_PX * 1.6 }}>
            <span className="h-3 w-3 rounded-full bg-white" />
            <span className="mt-2 whitespace-nowrap text-[0.8125rem] font-semibold">
              {WORDS.sent[lang]}
            </span>
          </span>
          {months.map((m, i) => (
            <span
              key={i}
              className="flex shrink-0 flex-col items-start"
              style={{ width: MONTH_PX }}
            >
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-white/80" />
              <span className="mt-2.5 text-[0.75rem] text-white/85">{m}</span>
            </span>
          ))}
        </motion.div>
      </div>
      {/* "now" at the line's end, never reached. */}
      <span className="absolute right-5 top-0 flex flex-col items-center">
        <motion.span
          className="h-3 w-3 rounded-full border-2 border-white bg-[#FF4D00]"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <span className="mt-2 text-[0.8125rem] font-semibold">{WORDS.now[lang]}</span>
      </span>
    </div>
  );
}

/** What the app's link shows: its picture, name and where it leads. Also what the phone grows from. */
export function LinkFace() {
  const { lang } = useLang();
  return (
    <>
      <img src="/og-image.png" alt="" className="block aspect-[1200/630] w-full object-cover" />
      <span className="flex flex-col px-3.5 py-2.5 leading-tight text-[#1c1c1e]">
        <span className="text-[1rem] font-semibold">{APP_NAME}</span>
        <span className="text-[0.8125rem] text-[#8A8D91]">{WORDS.linkDetail[lang]}</span>
      </span>
    </>
  );
}

/**
 * Before the welcome's animation (#275), the joke shown rather than told, no
 * phone and no buttons, on orange over the whole screen: "Vi kender det
 * alle:" alone in the middle, then up to the top; a friend's grey message,
 * "Det lyder SÅ sjovt!", types itself, then "Vi finder lige en dag" takes its
 * place, alone; it grows old (cracks, cobwebs, yellowing, its words fading)
 * while the months race past under it and away; the line goes back to the
 * middle, alone, as it turns into "Alle ved det ik bliver til noget...", then
 * "Men nu gør det!"; "Introducerer:" the app's icon, popping up big; back up as "Næste gang, svar med den her.", beside the old message,
 * while the icon itself turns into the person's own reply, the app's
 * link, pressed. Its place is handed on for the animation's phone to grow out of
 * (AppWelcome, WelcomeStage).
 */
export default function WelcomeIntro({
  onDone,
}: {
  /** Handed the link card's place on the screen, for the phone to grow out of. */
  onDone: (from: MorphRect | null) => void;
}) {
  const { lang } = useLang();
  const still = useReducedMotion() ?? false;
  const [now, setNow] = useState(0);
  const link = useRef<HTMLDivElement>(null);
  const first = WORDS.first[lang];
  const message = WORDS.message[lang];
  const [typedFirst, setTypedFirst] = useState(0);
  const [typed, setTyped] = useState(0);
  const fresh = useMotionValue(0);
  const second = now >= AT.second;
  const age = useMotionValue(0);

  useEffect(() => {
    const k = still ? 0.5 : 1;
    const timers = Object.values(AT).map((t) => window.setTimeout(() => setNow(t), t * k));
    const end = window.setTimeout(() => {
      const r = link.current?.getBoundingClientRect();
      onDone(
        r ? { left: r.left, top: r.top, width: r.width, height: r.height, borderRadius: 22 } : null,
      );
    }, AT.zoom * k);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(end);
    };
  }, [onDone, still]);

  // First "Det lyder SÅ sjovt!" types itself; then, in its place, "Vi finder lige en dag".
  useEffect(() => {
    if (now < AT.bubble) return;
    const next = second
      ? typed < message.length && (() => setTyped((n) => n + 1))
      : typedFirst < first.length && (() => setTypedFirst((n) => n + 1));
    if (!next) return;
    const t = window.setTimeout(next, still ? 0 : TYPE_MS);
    return () => window.clearTimeout(t);
  }, [now, second, typed, typedFirst, message.length, first.length, still]);

  const aging = now >= AT.aging;
  useEffect(() => {
    if (!aging) return;
    const run = animate(age, 1, { duration: still ? AGE_S / 2 : AGE_S, ease: "linear" });
    return () => run.stop();
  }, [aging, age, still]);

  const up = now >= AT.up;
  const heading =
    now >= AT.back
      ? WORDS.reply
      : now >= AT.present
        ? WORDS.present
        : now >= AT.turn
          ? WORDS.turn
          : now >= AT.verdict
            ? WORDS.verdict
            : WORDS.relate;
  // The line alone in the middle: at the start, and again for "Næste gang, svar med den her."
  const alone = !up || (now >= AT.verdict && now < AT.back);
  const tapped = now >= AT.tap;
  // From the middle of the screen up to the line's own box near the top.
  const middle = typeof window === "undefined" ? 300 : window.innerHeight * 0.5 - 130;
  const move = { duration: 0.7, ease: [0.32, 0.72, 0, 1] } as const;
  const presenting = now >= AT.present && now < AT.back;
  // The icon, big in the middle; then off to the middle of the link's picture, at its height.
  const W = typeof window === "undefined" ? 390 : window.innerWidth;
  const H = typeof window === "undefined" ? 844 : window.innerHeight;
  const icon = Math.min(W * 0.56, 230);
  const iconY = H * 0.5 + 30;
  const card = Math.min(W * 0.68, 272);
  const picture = ((card - 6) * 630) / 1200;
  // The picture, then the name and where it leads, inside a 3 px white edge.
  const cardHeight = picture + 62;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-[#FF4D00] text-white">
      {/* Every part has its own fixed place, so nothing ever moves another. The line at
          the top: each one fades in over the last, in the same box. */}
      <motion.div
        className="absolute inset-x-0 h-[9rem]"
        style={{ top: "max(2.5rem, calc(env(safe-area-inset-top) + 1rem))" }}
        initial={{ y: middle, scale: 1.12, opacity: 0 }}
        animate={{
          // "Introducerer:" stands above the icon; the other lines alone in the middle.
          y: presenting ? middle - icon / 2 - 60 : alone ? middle : 0,
          scale: alone ? 1.12 : 1,
          opacity: tapped ? 0 : 1,
        }}
        transition={move}
      >
        {/* The old line gone before the new one comes, so they never stand over each other. */}
        <AnimatePresence initial={false} mode="wait">
          <motion.h2
            key={heading.da}
            className="absolute inset-0 flex items-center justify-center text-balance px-8 text-center text-[2.375rem] font-bold leading-[1.1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <span>{heading[lang]}</span>
          </motion.h2>
        </AnimatePresence>
      </motion.div>

      {/* The friend's message, from the left, typing itself; then growing old. */}
      <AnimatePresence>
        {now >= AT.bubble && (
          <motion.div
            className="absolute inset-x-5 top-[34%] flex flex-col"
            initial={{ x: "-110%", opacity: 0 }}
            // Away while the line is alone in the middle; back, still old, after.
            animate={{ x: 0, opacity: (now >= AT.verdict && now < AT.back) || tapped ? 0 : 1 }}
            // Back only once the line above has made room for it.
            transition={now >= AT.back && !tapped ? { ...move, delay: 0.35 } : move}
          >
            {/* One message at a time: the catchphrase replaces the first, so it alone grows old. */}
            <AnimatePresence mode="wait" initial={false}>
              {second ? (
                <motion.div
                  key="second"
                  className="flex flex-col"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                >
                  <AgingBubble text={message} typed={typed} age={age} />
                </motion.div>
              ) : (
                <motion.div
                  key="first"
                  className="flex flex-col"
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <AgingBubble text={first} typed={typedFirst} age={fresh} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time passing, under the message. */}
      <AnimatePresence>
        {aging && now < AT.fade && (
          <motion.div
            className="absolute inset-x-5 top-[calc(34%+8.5rem)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Timeline lang={lang} run={aging} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* The app, introduced: its icon pops up big; then the icon itself becomes the link,
          moving and widening into it as the logo gives way to the link's picture and name,
          one shape the whole way. The phone grows out of it. */}
      {now >= AT.present && (
        <motion.div
          ref={link}
          aria-hidden={now < AT.back}
          className="absolute overflow-hidden border-[3px] border-white shadow-xl"
          initial={{
            left: W / 2 - icon / 2,
            top: iconY - icon / 2,
            width: icon,
            height: icon,
            borderRadius: `${icon * 0.22}px ${icon * 0.22}px ${icon * 0.22}px ${icon * 0.22}px`,
            backgroundColor: "#FF4D00",
            scale: 0.3,
            opacity: 0,
          }}
          animate={
            now < AT.back
              ? { scale: 1, opacity: 1 }
              : {
                  left: W - 20 - card,
                  top: H * 0.34 + 128,
                  width: card,
                  height: cardHeight,
                  borderRadius: "22px 22px 6px 22px",
                  scale: now >= AT.tap && now < AT.zoom ? [1, 0.94, 1] : 1,
                  opacity: now >= AT.zoom ? 0 : 1,
                }
          }
          transition={
            now < AT.back
              ? { type: "spring", stiffness: 260, damping: 18 }
              : {
                  ...OPEN,
                  scale: { duration: 0.4, times: [0, 0.4, 1] },
                  // Handed over: gone once the growing copy stands over it.
                  opacity: now >= AT.zoom ? { delay: 0.15, duration: 0 } : { duration: 0 },
                }
          }
        >
          {/* The link as it will be, at its own width, showing as the icon opens into it. */}
          <motion.div
            className="absolute left-0 top-0 bg-white text-[#1c1c1e]"
            style={{ width: card - 6 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: now >= AT.back ? 1 : 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <LinkFace />
          </motion.div>
          {/* The icon's logo, staying in the middle of what becomes the link's picture. */}
          <motion.div
            className="absolute inset-x-0 top-0 flex items-center justify-center"
            initial={{ height: icon - 6, opacity: 1 }}
            animate={
              now >= AT.back ? { height: picture, opacity: 0 } : { height: icon - 6, opacity: 1 }
            }
            transition={{
              height: OPEN,
              opacity: { duration: 0.35, delay: 0.35 },
            }}
          >
            <LogoMark className="h-[68%] w-auto text-white" label="" />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
