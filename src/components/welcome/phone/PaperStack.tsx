import { memo } from "react";
import { motion, type Easing } from "framer-motion";

import { jostle, sheetTilt } from "@/lib/paperPile";
import type { GridItem } from "@/lib/monthGrid";
import { FRIENDS } from "./demo";
import { SCREEN } from "./geometry";
import { HIT, THROWS } from "./throws";
import PaperCalendar from "./PaperCalendar";

/** Right, left, right: one sheet from each hand, as in a shuffle. */
const sideOf = (k: number): 1 | -1 => (k % 2 === 0 ? 1 : -1);

const FLIGHT_EASE: Easing[] = [[0.3, 0.1, 0.85, 0.6], "easeOut", "easeInOut"];

/**
 * One paper calendar flying in from outside the phone to land crooked on the
 * pile. Later ones knock it a little (`landed`, on a layer of its own, so a
 * knock never restarts its flight). Squared, it lies straight and exactly over
 * the screen, ready to turn digital.
 */
const Sheet = memo(function Sheet({
  k,
  landed,
  squared,
  month,
  items,
}: {
  k: number;
  landed: number;
  squared: boolean;
  month: number;
  items: GridItem[];
}) {
  const side = sideOf(k);
  const friend = FRIENDS[k];
  const throwIt = THROWS[k];
  const lie = sheetTilt(k + 1);
  const tilt = { rotate: lie.rotate * 0.8, x: lie.x * 1.6, y: lie.y };
  // Far enough out that a sheet waiting for its turn is not seen at the edge.
  const from = side * SCREEN.width * 2.4;
  const hit = throwIt.fly / (throwIt.fly + HIT);
  const knock = jostle(k, landed);
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ x: from, y: -110, rotate: side * 18, scale: 1.3 }}
      animate={
        squared
          ? { x: 0, y: 0, rotate: 0, scale: 1 }
          : {
              x: [from, tilt.x - side * 6, tilt.x + side * 2, tilt.x],
              y: [-110, tilt.y + 3, tilt.y - 5, tilt.y],
              rotate: [side * 18, tilt.rotate - side, tilt.rotate + side * 0.4, tilt.rotate],
              scale: [1.3, 0.985, 1.008, 1],
            }
      }
      transition={
        squared
          ? { type: "spring", stiffness: 340, damping: 30 }
          : {
              delay: throwIt.at,
              duration: throwIt.fly + HIT,
              times: [0, hit, hit + (1 - hit) * 0.45, 1],
              ease: FLIGHT_EASE,
            }
      }
    >
      <motion.div
        className="h-full w-full"
        animate={squared ? { x: 0, rotate: 0 } : knock}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
      >
        {/* A sheet of paper throws a shadow on what is under it. */}
        <motion.div
          className="h-full w-full overflow-hidden"
          style={{ boxShadow: "0 18px 40px -10px rgb(0 0 0 / 0.42)" }}
          initial={{ borderRadius: 10 }}
          animate={{ borderRadius: squared ? SCREEN.radius : 10 }}
          transition={{ duration: 0.22 }}
        >
          <PaperCalendar
            month={month}
            items={items}
            who={friend.id}
            name={friend.name}
            color={friend.color}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

/**
 * The friends' real paper calendars (#228), thrown onto the phone one by one,
 * quicker and quicker, into a messy pile that stays lying on top. Only with all
 * of them there do they square up and turn digital together (`TurnDigital`).
 */
export default function PaperStack({
  landed,
  squared,
  month,
  items,
}: {
  /** How many have landed so far. */
  landed: number;
  squared: boolean;
  month: number;
  /** Everyone's, so each pen mark sits exactly where its bar will. */
  items: GridItem[];
}) {
  return (
    <>
      {FRIENDS.map((f, k) => (
        <Sheet key={f.id} k={k} landed={landed} squared={squared} month={month} items={items} />
      ))}
    </>
  );
}

/** The moment of it: from when the light starts, seconds until it hides the screen, and in all. */
export const TURN_COVERED = 0.26;
export const TURN_ALL = 0.8;

/**
 * Paper becoming digital: a soft light swelling from the middle of the screen
 * until it hides everything, then clearing to the real calendar. The paper is
 * taken away while it can't be seen, and only transforms and opacity change.
 */
export function TurnDigital() {
  const cover = TURN_COVERED / TURN_ALL;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: SCREEN.radius }}>
      <motion.div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 1200,
          height: 1200,
          marginLeft: -600,
          marginTop: -600,
          background:
            "radial-gradient(circle, #fff 0%, #fff 62%, rgb(255 244 230 / 0.85) 74%, transparent 100%)",
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 1.1, 1.1], opacity: [1, 1, 0] }}
        transition={{ duration: TURN_ALL, times: [0, cover, 1], ease: ["easeIn", "easeOut"] }}
      />
    </div>
  );
}
