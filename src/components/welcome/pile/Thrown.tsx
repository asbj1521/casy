import { type ReactNode } from "react";
import { motion } from "framer-motion";

import { PILE_TIMING, sheetTilt, throwSide } from "@/lib/paperPile";
import { PILE } from "./demo";

/**
 * One friend's calendar thrown onto the pile as Planlæg throws it, on its
 * timeline (PileScreen's ThrownLayer, simplified): from high above and to the
 * side, falling faster into the hit, a small skid and hop, settling crooked;
 * pressed, straight into line without a bounce.
 */
export default function Thrown({
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
