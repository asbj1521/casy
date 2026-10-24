import { memo, useMemo, type ReactNode } from "react";
import { motion, type TargetAndTransition, type Transition } from "framer-motion";

import { jostle, PILE_TIMING, sheetTilt, throwSide } from "@/lib/paperPile";
import { type Frame } from "./shared";

/**
 * One friend's calendar, tossed onto the pile like a sheet thrown onto a
 * table (`throwSide`): it starts high above and to the side (big, close to
 * you), falls faster and faster for `land.duration`, then the hit
 * (PILE_TIMING.impact): squashed flat for an instant, a small skid past
 * where it ends up, a hop, and settling crooked. Its shadow stays on the
 * table, faint and wide while it is high, closing in and darkening as it
 * comes down. Every calendar landing on it after knocks it a little
 * (`jostle`, on a layer of its own so a knock never restarts the throw).
 * Pressed, it settles straight without a bounce, and stays: the pile is now
 * the group's calendar together, where the free days light up. Revealed,
 * only its name and its shadow go.
 */
const ThrownLayer = memo(function ThrownLayer({
  k,
  frame,
  land,
  landed,
  pressed,
  revealed,
  alpha,
  name,
  color,
  children,
}: {
  k: number;
  frame: Frame;
  land: { at: number; duration: number };
  landed: number;
  pressed: boolean;
  revealed: boolean;
  alpha: number;
  name: string;
  color: string;
  children: ReactNode;
}) {
  const toss = useMemo((): {
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    shadowFrom: TargetAndTransition;
    shadow: TargetAndTransition;
    transition: Transition;
  } => {
    const tilt = sheetTilt(k + 1);
    const side = throwSide(k);
    const from = side * frame.width * 0.55;
    const hit = land.duration / (land.duration + PILE_TIMING.impact);
    return {
      initial: { x: from, y: -150, rotate: side * -14, scale: 1.6, opacity: 0 },
      animate: {
        x: [from, tilt.x - side * 7, tilt.x + side * 2, tilt.x],
        y: [-150, tilt.y + 3, tilt.y - 8, tilt.y],
        rotate: [side * -14, tilt.rotate - side * 1.5, tilt.rotate + side * 0.6, tilt.rotate],
        scale: [1.6, 0.975, 1.012, 1],
        opacity: [0, 1, 1, 1],
      },
      shadowFrom: { x: from * 0.4, y: 50, scale: 1.3, opacity: 0 },
      shadow: {
        x: [from * 0.4, tilt.x - side * 7, tilt.x + side * 2, tilt.x],
        y: [50, tilt.y + 12, tilt.y + 14, tilt.y + 12],
        scale: [1.3, 0.99, 1.01, 1],
        rotate: [side * -6, tilt.rotate, tilt.rotate, tilt.rotate],
        opacity: [0, 0.38, 0.3, 0.28],
      },
      transition: {
        delay: land.at,
        duration: land.duration + PILE_TIMING.impact,
        times: [0, hit, hit + (1 - hit) * 0.4, 1],
        // Falling: faster and faster into the hit; then the hop out and back.
        ease: [[0.55, 0, 1, 0.45], "easeOut", "easeInOut"],
      },
    };
  }, [k, frame.width, land.at, land.duration]);
  const knock = jostle(k, landed);
  const place = { top: frame.top, left: frame.left, width: frame.width };
  const settle: Transition = { type: "spring", stiffness: 170, damping: 26 };

  return (
    <>
      {/* The shadow on the table, under the calendar coming down. */}
      <motion.div
        className="absolute rounded-[28px] bg-black blur-2xl"
        style={{ ...place, height: frame.height }}
        initial={toss.shadowFrom}
        animate={
          revealed
            ? { x: 0, y: 12, rotate: 0, scale: 1, opacity: 0 }
            : pressed
              ? { x: 0, y: 12, rotate: 0, scale: 1, opacity: 0.28 }
              : toss.shadow
        }
        transition={revealed || pressed ? settle : toss.transition}
      />
      <motion.div
        className="absolute"
        style={{ ...place, transformOrigin: "50% 35%" }}
        initial={toss.initial}
        animate={pressed ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 } : toss.animate}
        transition={pressed ? settle : toss.transition}
      >
        <motion.div
          animate={pressed ? { x: 0, rotate: 0 } : knock}
          transition={{ type: "spring", stiffness: 520, damping: pressed ? 40 : 16 }}
        >
          <div
            className="relative rounded-[28px] border"
            style={{
              backgroundColor: `rgb(var(--glass-tint) / ${alpha})`,
              borderColor: "rgb(var(--glass-edge))",
              boxShadow: "inset 0 1px 0 rgb(var(--glass-edge))",
            }}
          >
            {children}
            <motion.span
              className="glass absolute right-3 top-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-foreground"
              animate={{ opacity: revealed ? 0 : 1 }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${color})` }} />
              {name}
            </motion.span>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
});

export default ThrownLayer;
