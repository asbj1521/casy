import { memo } from "react";
import { motion, type Easing } from "framer-motion";

import { jostle, sheetTilt } from "@/lib/paperPile";
import type { GridItem } from "@/lib/monthGrid";
import { FRIENDS } from "./demo";
import { SCREEN } from "./geometry";
import PaperCalendar from "./PaperCalendar";
import { HIT, THROWS } from "./throws";

/** Right, left, right: one sheet from each hand, as in a shuffle. */
const sideOf = (k: number): 1 | -1 => (k % 2 === 0 ? 1 : -1);

/** Slow off the hand, fast through the air, slow into the landing; then a small bounce. */
const FLIGHT_EASE: Easing[] = [[0.55, 0, 0.15, 1], "easeOut", "easeInOut"];

/**
 * One paper calendar flying in from outside the phone to land crooked on the
 * pile. It moves as a thrown thing does (FLIGHT_EASE), going a little past its
 * spot and back. Later ones knock it a little (`landed`, on a layer of its own,
 * so a knock never restarts its flight). Squared, it lies straight and exactly
 * over the screen.
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
  const fly = THROWS[k].fly;
  const lie = sheetTilt(k + 1);
  const tilt = { rotate: lie.rotate * 0.8, x: lie.x * 1.6, y: lie.y };
  // Just outside the stage: further out, the slow start would happen unseen.
  const from = side * SCREEN.width * 1.75;
  const hit = fly / (fly + HIT);
  const knock = jostle(k, landed);
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ x: from, y: -90, rotate: side * 16, scale: 1.24 }}
      animate={
        squared
          ? { x: 0, y: 0, rotate: 0, scale: 1 }
          : {
              x: [from, tilt.x - side * 12, tilt.x + side * 3, tilt.x],
              y: [-90, tilt.y + 7, tilt.y - 4, tilt.y],
              rotate: [side * 16, tilt.rotate - side * 2, tilt.rotate + side * 0.5, tilt.rotate],
              scale: [1.24, 0.98, 1.008, 1],
            }
      }
      transition={
        squared
          ? { type: "spring", stiffness: 240, damping: 28 }
          : {
              duration: fly + HIT,
              times: [0, hit, hit + (1 - hit) * 0.5, 1],
              ease: FLIGHT_EASE,
            }
      }
    >
      <motion.div
        className="h-full w-full"
        animate={squared ? { x: 0, rotate: 0 } : knock}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* A sheet of paper throws a shadow on what is under it. */}
        <motion.div
          className="h-full w-full overflow-hidden"
          style={{ boxShadow: "0 18px 40px -10px rgb(0 0 0 / 0.42)" }}
          initial={{ borderRadius: 10 }}
          animate={{ borderRadius: squared ? SCREEN.radius : 10 }}
          transition={{ duration: 0.3 }}
        >
          <PaperCalendar
            month={month}
            items={items}
            who={friend.id}
            title={friend.name}
            color={friend.color}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

/**
 * The friends' real paper calendars (#228), thrown onto the phone one by one,
 * quicker and quicker, into a messy pile that stays lying on top until they
 * square up. `thrown` have left the hand so far: a sheet is only there from its
 * throw, so none waits in view at the edge.
 */
export default function PaperStack({
  thrown,
  landed,
  squared,
  month,
  items,
}: {
  thrown: number;
  /** How many have landed so far. */
  landed: number;
  squared: boolean;
  month: number;
  /** Everyone's, so each pen mark sits exactly where its bar will. */
  items: GridItem[];
}) {
  return (
    <>
      {FRIENDS.map(
        (f, k) =>
          k < thrown && (
            <Sheet key={f.id} k={k} landed={landed} squared={squared} month={month} items={items} />
          ),
      )}
    </>
  );
}
