import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { MorphRect } from "@/components/welcome/phone/morph";
import { APP_NAME } from "@/i18n/brand";
import { useLang } from "@/i18n/lang";

const WORDS = {
  relate: { da: "Kender du typen?", en: "Sound familiar?" },
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
const AT = { bubble: 500, aging: 2000, reply: 5200, link: 5800, zoom: 7600 };

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
 * and no buttons: on orange, "Kender du typen?" and a friend's grey message
 * ending in "Vi finder lige en dag"; it ages (greying, cobwebs, weeks then
 * months passing); then "Næste gang, svar med den her." and the person's own
 * reply, the app's link, from the right. It zooms into that link, which hands
 * over to the animation's phone (AppWelcome).
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
  useEffect(() => {
    const times = Object.values(AT);
    const timers = times.map((t) => window.setTimeout(() => setNow(t), still ? t / 2 : t));
    const end = window.setTimeout(
      () => {
        const r = link.current?.getBoundingClientRect();
        onDone(
          r
            ? { left: r.left, top: r.top, width: r.width, height: r.height, borderRadius: 22 }
            : null,
        );
      },
      still ? AT.zoom / 2 : AT.zoom,
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(end);
    };
  }, [onDone, still]);

  const aging = now >= AT.aging;
  const later = aging ? Math.min(WORDS.later.length - 1, Math.floor((now - AT.aging) / 1000)) : -1;
  const zooming = now >= AT.zoom;

  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[#FF4D00] text-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="flex min-h-[9rem] items-end justify-center px-8 pb-6"
        style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}
      >
        <AnimatePresence mode="wait">
          <motion.h2
            key={now >= AT.reply ? "reply" : "relate"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: zooming ? 0 : 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="text-balance text-center text-[2rem] font-bold leading-tight"
          >
            {(now >= AT.reply ? WORDS.reply : WORDS.relate)[lang]}
          </motion.h2>
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5">
        {/* The friend's message, from the left: the plan that stalled. */}
        <AnimatePresence>
          {now >= AT.bubble && !zooming && (
            <motion.div
              className="relative max-w-[80%] self-start"
              initial={{ x: "-120%", opacity: 0 }}
              animate={{
                x: 0,
                opacity: aging ? 0.7 : 1,
                rotate: aging ? -2 : 0,
                filter: aging ? "grayscale(1) blur(0.3px)" : "grayscale(0)",
              }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <span className="block rounded-[22px] rounded-bl-[6px] bg-[#EFEFF1] px-4 py-3 text-[1.1875rem] leading-snug text-[#1c1c1e]">
                {WORDS.message[lang]}
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

        {/* The person's own reply, from the right: the app's link. It grows into the phone. */}
        <AnimatePresence>
          {now >= AT.link && (
            <motion.div
              ref={link}
              className="w-[68%] max-w-[17rem] origin-center self-end overflow-hidden rounded-[22px] rounded-br-[6px] border-[3px] border-white bg-white text-[#1c1c1e] shadow-xl"
              initial={{ x: "120%", opacity: 0 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
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
    </motion.div>
  );
}
