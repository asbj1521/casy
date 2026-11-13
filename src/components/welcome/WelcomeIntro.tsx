import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { MorphRect } from "@/components/welcome/phone/morph";
import { APP_NAME } from "@/i18n/brand";
import { useLang } from "@/i18n/lang";

const WORDS = {
  relate: { da: "Er det også sket for dig?", en: "Has this ever happened to you?" },
  reply: { da: "Næste gang, svar med den her.", en: "Next time, reply with this." },
  message: {
    da: "Det lyder SÅ sjovt! Vi finder lige en dag 😍",
    en: "That sounds SO fun! We'll find a day 😍",
  },
  later: [
    { da: "1 uge senere", en: "1 week later" },
    { da: "3 uger senere", en: "3 weeks later" },
    { da: "2 måneder senere", en: "2 months later" },
  ],
  linkDetail: { da: "Find en dag · App Store", en: "Find a day · App Store" },
};

/** When each part starts, in ms from the intro's start. */
const AT = { up: 1300, bubble: 1800, aging: 4300, reply: 10300, link: 10900, zoom: 12700 };
/** How long each "senere" stands while the message ages. */
const LATER_MS = 1900;
/** How fast the friend's message types itself, per letter. */
const TYPE_MS = 45;

/** A cobweb in a corner, spun thread by thread. */
function Cobweb({ className }: { className: string }) {
  const spokes = [0, 22, 45, 68, 90].map((deg) => {
    const r = (deg * Math.PI) / 180;
    return `M0 0 L${(Math.cos(r) * 60).toFixed(1)} ${(Math.sin(r) * 60).toFixed(1)}`;
  });
  // Each ring sags a little between its spokes, as old threads do.
  const angles = [0, 22, 45, 68, 90].map((deg) => (deg * Math.PI) / 180);
  const rings = [18, 32, 46, 58].map((d) => {
    const pt = (r: number, k = 1) =>
      `${(Math.cos(r) * d * k).toFixed(1)} ${(Math.sin(r) * d * k).toFixed(1)}`;
    let path = `M${pt(angles[0])}`;
    for (let i = 1; i < angles.length; i++) {
      path += ` Q${pt((angles[i - 1] + angles[i]) / 2, 0.86)} ${pt(angles[i])}`;
    }
    return path;
  });
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden fill="none">
      {[...spokes, ...rings].map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke="rgb(255 255 255 / 0.85)"
          strokeWidth={1}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i }}
        />
      ))}
    </svg>
  );
}

/**
 * Before the welcome's animation (#275), the joke in a few seconds, no phone
 * and no buttons, on orange over the whole screen: "Er det også sket for dig?"
 * alone in the middle, then up to the top; a friend's grey message types
 * itself, ending in "Vi finder lige en dag"; it ages (its words blurring away,
 * cobwebs, weeks then months passing); then "Næste gang, svar med den her." and
 * the person's own reply, the app's link, from the right. Its place is handed
 * on for the animation's phone to grow out of (AppWelcome, WelcomeStage).
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
  const message = WORDS.message[lang];
  // Letters typed so far: one at a time from when the bubble appears.
  const [typed, setTyped] = useState(0);

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

  useEffect(() => {
    if (now < AT.bubble || typed >= message.length) return;
    const t = window.setTimeout(() => setTyped((n) => n + 1), still ? 0 : TYPE_MS);
    return () => window.clearTimeout(t);
  }, [now, typed, message.length, still]);

  const up = now >= AT.up;
  const aging = now >= AT.aging;
  // Which "senere" stands: its own clock, a step every LATER_MS while the message ages.
  const [later, setLater] = useState(-1);
  useEffect(() => {
    if (!aging) return;
    const timers = WORDS.later.map((_, i) =>
      window.setTimeout(() => setLater(i), i * LATER_MS * (still ? 0.5 : 1)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [aging, still]);

  // From the middle of the screen to its top: about a third of the screen's height.
  const middle = typeof window === "undefined" ? 300 : window.innerHeight * 0.34;

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[#FF4D00] text-white">
      <div
        className="flex min-h-[9.5rem] items-end justify-center px-8 pb-6"
        style={{ paddingTop: "max(3rem, calc(env(safe-area-inset-top) + 1.5rem))" }}
      >
        <AnimatePresence mode="wait">
          <motion.h2
            key={now >= AT.reply ? "reply" : "relate"}
            initial={
              now >= AT.reply ? { opacity: 0, y: 12 } : { opacity: 0, y: middle, scale: 1.15 }
            }
            animate={up ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: middle, scale: 1.15 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 140, damping: 20 }}
            className="text-balance text-center text-[2rem] font-bold leading-tight"
          >
            {(now >= AT.reply ? WORDS.reply : WORDS.relate)[lang]}
          </motion.h2>
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5">
        {/* The friend's message, from the left, typing itself: the plan that stalled. */}
        <AnimatePresence>
          {now >= AT.bubble && (
            <motion.div
              className="relative max-w-[82%] self-start"
              initial={{ x: "-110%", opacity: 0 }}
              animate={{ x: 0, opacity: aging ? 0.75 : 1, rotate: aging ? -2 : 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <span className="relative block rounded-[22px] rounded-bl-[6px] bg-[#EFEFF1] px-4 py-3 text-[1.1875rem] leading-snug text-[#1c1c1e]">
                {/* The whole text holds the bubble's size; what is typed shows over it. */}
                <span className="invisible">{message}</span>
                <motion.span
                  className="absolute inset-0 px-4 py-3"
                  animate={{
                    filter: aging ? "blur(3.5px)" : "blur(0px)",
                    opacity: aging ? 0.55 : 1,
                  }}
                  transition={{ duration: 5.5, ease: "easeIn" }}
                >
                  {message.slice(0, typed)}
                  {typed < message.length && (
                    <motion.span
                      className="ml-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-[#1c1c1e]"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </motion.span>
              </span>
              {aging && (
                <>
                  <Cobweb className="absolute -left-2 -top-3 h-14 w-14" />
                  <Cobweb className="absolute -bottom-3 -right-2 h-12 w-12 rotate-180" />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time passing, under it. */}
        <div className="h-7 self-start pl-2">
          <AnimatePresence mode="wait">
            {later >= 0 && now < AT.reply && (
              <motion.p
                key={later}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 0.85, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="text-[0.9375rem] font-semibold uppercase tracking-wide"
              >
                {WORDS.later[later][lang]}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* The person's own reply, from the right: the app's link. The phone grows out of it. */}
        <AnimatePresence>
          {now >= AT.link && (
            <motion.div
              ref={link}
              className="w-[68%] max-w-[17rem] self-end overflow-hidden rounded-[22px] rounded-br-[6px] border-[3px] border-white bg-white text-[#1c1c1e] shadow-xl"
              initial={{ x: "120%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <img
                src="/og-image.png"
                alt=""
                className="block aspect-[1200/630] w-full object-cover"
              />
              <span className="flex flex-col px-3.5 py-2.5 leading-tight">
                <span className="text-[1rem] font-semibold">{APP_NAME}</span>
                <span className="text-[0.8125rem] text-[#8A8D91]">{WORDS.linkDetail[lang]}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
