import { motion, type Easing } from "framer-motion";

import type { GridItem } from "@/lib/monthGrid";
import PaperCalendar from "./PaperCalendar";
import { SCREEN } from "./geometry";

/** The hit: squashed for an instant, a small skid, a hop, settling (Planlæg's throw, ThrownLayer). */
export const IMPACT = 0.34;
/** Paper turning digital, from the edge that landed first across to the other. */
export const TURN = 0.55;
const TURN_EASE: Easing = [0.45, 0, 0.3, 1];

/**
 * A paper calendar from outside the phone (#228): it comes in from `side`
 * (1 right, -1 left) big and crooked, a thing in the air, with its own shadow;
 * lands square on the screen; then a band of light crosses it and the paper
 * gives way to what is already on the screen under it, the same bars on the
 * same days. The phone must lie flat while this happens, since the paper and
 * the screen only line up then.
 *
 * The turn moves a clipped box one way and the paper inside it the other, so
 * only transforms change: a mask moved across it would be redrawn every frame.
 */
export default function FlyingCalendar({
  side,
  fly,
  month,
  items,
  who,
  name,
  color,
}: {
  side: 1 | -1;
  /** Seconds in the air. */
  fly: number;
  month: number;
  items: GridItem[];
  who: string;
  name: string;
  color: string;
}) {
  const from = side * SCREEN.width * 1.65;
  const hit = fly / (fly + IMPACT);
  const flight = {
    duration: fly + IMPACT,
    times: [0, hit, hit + (1 - hit) * 0.45, 1],
    ease: [[0.3, 0.1, 0.9, 0.55], "easeOut", "easeInOut"] as Easing[],
  };
  const turn = { delay: fly + IMPACT, duration: TURN, ease: TURN_EASE };
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ x: from, y: -110, rotate: side * 15, scale: 1.34 }}
      animate={{
        x: [from, -side * 6, side * 2, 0],
        y: [-110, 3, -7, 0],
        rotate: [side * 15, -side * 1.4, side * 0.5, 0],
        scale: [1.34, 0.985, 1.01, 1],
      }}
      transition={flight}
    >
      {/* Its shadow on the phone, gone as it stops being a thing lying on top. */}
      <motion.div
        className="absolute inset-0"
        style={{
          borderRadius: SCREEN.radius,
          boxShadow: "0 40px 70px -14px rgb(0 0 0 / 0.5), 0 8px 18px -4px rgb(0 0 0 / 0.28)",
        }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: fly + IMPACT * 0.6, duration: 0.3 }}
      />
      <motion.div
        className="absolute inset-0 overflow-hidden"
        initial={{ x: 0 }}
        animate={{ x: side * SCREEN.width }}
        transition={turn}
      >
        <motion.div
          className="h-full w-full"
          initial={{ x: 0 }}
          animate={{ x: -side * SCREEN.width }}
          transition={turn}
        >
          <motion.div
            className="h-full w-full overflow-hidden"
            initial={{ borderRadius: 10 }}
            animate={{ borderRadius: SCREEN.radius }}
            transition={{ delay: fly * 0.75, duration: fly * 0.25 + IMPACT * 0.5 }}
          >
            <PaperCalendar month={month} items={items} who={who} name={name} color={color} />
          </motion.div>
        </motion.div>
      </motion.div>
      {/* The band of light on the line between paper and screen. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: SCREEN.radius }}
        aria-hidden
      >
        <motion.div
          className="absolute inset-y-0 w-[120px]"
          style={{
            left: side === 1 ? -60 : undefined,
            right: side === 1 ? undefined : -60,
            background:
              "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.95) 50%, transparent)",
          }}
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: side * SCREEN.width, opacity: [0, 1, 1, 0] }}
          transition={{ ...turn, opacity: { ...turn, times: [0, 0.12, 0.85, 1], ease: "linear" } }}
        />
      </div>
    </motion.div>
  );
}
