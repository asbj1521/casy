import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import Avatar from "@/components/ui/Avatar";
import FlyingCalendar, { IMPACT, TURN } from "./phone/FlyingCalendar";
import PhoneDevice from "./phone/PhoneDevice";
import { DEVICE } from "./phone/geometry";
import PhoneHome from "./phone/PhoneHome";
import { demoMonth, demoPlan, FRIENDS, PEOPLE } from "./phone/demo";

/** How the phone stands: `y` a share of the stage's height, `scale` of its fitted size, degrees. */
const POSE = {
  /** Coming in, lying back with its bottom edge toward you. */
  rising: { y: 0.2, scale: 1.02, rotateX: 50, rotateY: 0, rotate: 0, opacity: 0 },
  lying: { y: -0.03, scale: 1.02, rotateX: 34, rotateY: 0, rotate: 0, opacity: 1 },
  /** Sunk to the bottom and cut off, making room for the shape and the card. */
  low: { y: 0.6, scale: 1.12, rotateX: 0, rotateY: 0, rotate: 0, opacity: 1 },
  /** Facing you: the only pose the paper calendars can land on. */
  flat: { y: 0, scale: 1.06, rotateX: 0, rotateY: 0, rotate: 0, opacity: 1 },
};
const POSE_SPRING = { type: "spring", stiffness: 60, damping: 16, mass: 1 } as const;

/** Where the colour shape lies in each pose, as shares of its panel. */
const SHAPE = {
  lying: { x: "-8%", y: "48%", rotate: -14, scale: 1, opacity: 1 },
  low: { x: "-24%", y: "-40%", rotate: 22, scale: 1.1, opacity: 1 },
  flat: { x: "-8%", y: "-110%", rotate: 40, scale: 1, opacity: 0 },
};

/**
 * The paper calendars land right, left, right, each sooner than the last, as
 * Planlæg throws them quicker and quicker.
 */
const SIDES = [1, -1, 1] as const;
const FLY = [0.72, 0.58, 0.46];
const GAP = [0.5, 0.3];

const AT = (() => {
  const low = 2;
  const flat = low + 1.9;
  let t = flat + 0.75;
  const throws = FLY.map((fly, k) => {
    const at = t;
    t += fly + IMPACT + TURN + (GAP[k] ?? 0);
    return at;
  });
  // A calendar goes onto the screen once its paper has landed over it, unseen.
  const landed = throws.map((at, k) => at + FLY[k] + IMPACT * 0.5);
  const gone = throws.map((at, k) => at + FLY[k] + IMPACT + TURN + 0.05);
  const pressed = t + 0.25;
  const shine = pressed + 0.75;
  return { low, flat, throws, landed, gone, pressed, shine, end: shine + 2.6 };
})();
const MOMENTS = [
  AT.low,
  AT.flat,
  ...AT.throws,
  ...AT.landed,
  ...AT.gone,
  AT.pressed,
  AT.shine,
].sort((a, b) => a - b);

/**
 * The app's welcome animation (#228): a real phone playing the app, moving to
 * make room. It leans back and straightens over a colour shape, sinks for the
 * friends' card, then stands facing you while real paper calendars fly in from
 * outside it, land on the screen and turn digital; pressed into one, the days
 * free for everyone light up. Everything else about the screen stays still
 * (AppWelcome). Under reduced motion, a still of the phone with the days lit.
 */
export default function WelcomeStage() {
  const still = useReducedMotion() ?? false;

  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Where in the round it is, as the last moment reached.
  const [round, setRound] = useState(0);
  const [reached, setReached] = useState({ round: 0, at: 0 });
  const now = still ? AT.end : reached.round === round ? reached.at : 0;
  useEffect(() => {
    if (still) return;
    const timers = MOMENTS.map((at) => setTimeout(() => setReached({ round, at }), at * 1000));
    timers.push(setTimeout(() => setRound((r) => r + 1), AT.end * 1000));
    return () => timers.forEach(clearTimeout);
  }, [round, still]);

  const [month] = useState(() => demoMonth(Date.now()));
  const plan = useMemo(() => demoPlan(month), [month]);
  const shine = useMemo(() => new Set(plan.free), [plan]);
  // Yours, then each friend's from when their paper has landed over the screen.
  const landedCount = 1 + AT.landed.filter((at) => now >= at).length;
  const items = useMemo(() => plan.items.slice(0, landedCount).flat(), [plan, landedCount]);

  const phase = now >= AT.flat ? "flat" : now >= AT.low ? "low" : "lying";
  const scale = Math.min((size.height * 0.8) / DEVICE.height, (size.width * 0.62) / DEVICE.width);
  const pose = POSE[phase];

  return (
    <div ref={stage} aria-hidden className="pointer-events-none relative h-full overflow-hidden">
      <motion.div
        key={round}
        className="absolute inset-0"
        initial={still ? false : { opacity: round === 0 ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ perspective: size.height * 1.7 }}
      >
        {/* The colour shape, in a panel of its own that fades out at the bottom. */}
        <div className="absolute inset-x-[7%] bottom-0 top-3 overflow-hidden rounded-[28px]">
          <motion.div
            className="absolute inset-x-[-30%] top-0"
            style={{ aspectRatio: "1 / 0.9" }}
            initial={still ? SHAPE.flat : { ...SHAPE.lying, y: "90%", opacity: 0 }}
            animate={still ? SHAPE.flat : SHAPE[phase]}
            transition={{
              type: "spring",
              stiffness: 42,
              damping: 15,
              // Gone before it has swept away, so it leaves no dark trail behind.
              opacity: { duration: 0.35, ease: "easeOut" },
            }}
          >
            <div
              className="absolute inset-0 rounded-[46%]"
              style={{
                background:
                  "radial-gradient(circle at 74% 26%, #ffd60a 0, transparent 44%), radial-gradient(circle at 82% 78%, #ff2d78 0, transparent 50%), linear-gradient(135deg, #fb923c, #f43f5e)",
              }}
            />
            <div
              className="absolute inset-x-[-6%] top-[52%] h-[70%] rounded-[50%]"
              style={{
                background:
                  "radial-gradient(circle at 20% 20%, #fbbf24 0, transparent 60%), linear-gradient(120deg, #f97316, #ec4899)",
              }}
            />
          </motion.div>
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* The friends' card on the shape, while the phone is low. */}
        <AnimatePresence>
          {phase === "low" && !still && (
            <motion.div
              className="absolute inset-x-[12%] top-[20%] flex items-center gap-3 rounded-[1.75rem] bg-card/95 p-4 shadow-xl shadow-black/15"
              initial={{ opacity: 0, y: 30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 170, damping: 20, delay: 0.25 }}
            >
              <span className="flex shrink-0 -space-x-2 large-text:hidden">
                {FRIENDS.map((f, i) => (
                  <Avatar
                    key={f.id}
                    name={f.name}
                    index={i + 1}
                    size="md"
                    className="ring-2 ring-card"
                  />
                ))}
              </span>
              <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-foreground">
                {FRIENDS.map((f) => f.name).join(", ")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The phone, centred and turned as one. */}
        {scale > 0 && (
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
              width: DEVICE.width,
              height: DEVICE.height,
              marginLeft: -DEVICE.width / 2,
              marginTop: -DEVICE.height / 2,
              transformStyle: "preserve-3d",
            }}
            initial={
              still
                ? false
                : {
                    ...POSE.rising,
                    y: POSE.rising.y * size.height,
                    scale: POSE.rising.scale * scale,
                  }
            }
            animate={
              still
                ? { ...POSE.flat, y: POSE.flat.y, scale: POSE.flat.scale * scale }
                : { ...pose, y: pose.y * size.height, scale: pose.scale * scale }
            }
            transition={still ? { duration: 0 } : POSE_SPRING}
          >
            <PhoneDevice
              over={
                !still &&
                AT.throws.map(
                  (at, k) =>
                    now >= at &&
                    now < AT.gone[k] && (
                      <FlyingCalendar
                        key={k}
                        side={SIDES[k]}
                        fly={FLY[k]}
                        month={month}
                        items={plan.items.slice(0, k + 2).flat()}
                        who={PEOPLE[k + 1].id}
                        name={PEOPLE[k + 1].name}
                        color={PEOPLE[k + 1].color}
                      />
                    ),
                )
              }
            >
              <PhoneHome
                month={month}
                items={items}
                pressed={!still && now >= AT.pressed}
                shine={now >= AT.shine ? shine : null}
              />
            </PhoneDevice>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
