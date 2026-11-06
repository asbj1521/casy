import { motion } from "framer-motion";

import { FRIENDS } from "./demo";
import { GROUP_ROWS, SCREEN } from "./geometry";
import { Face } from "./PhoneGroup";

/** How big a friend's face is around the phone, in the phone's own pixels. */
const BIG = 118;

/** Where each face waits around the phone, its centre in the screen's pixels: a crowd on both sides. */
const AROUND = [
  { x: -48, y: 150, drift: 10 },
  { x: SCREEN.width + 44, y: 96, drift: -12 },
  { x: -62, y: 470, drift: -9 },
  { x: SCREEN.width + 58, y: 400, drift: 11 },
  { x: SCREEN.width + 22, y: 700, drift: -10 },
];

/**
 * Your friends (#228), big, popping up all round the phone one after another;
 * then each flies into the group on its screen, shrinking into its own row.
 * The same move as the paper calendars after them: from outside the phone, in.
 */
export default function PeopleJoining({
  popAt,
  flyAt,
  flyFor,
}: {
  /** When each face pops up, from when this is shown. */
  popAt: readonly number[];
  /** When each face leaves for its row. */
  flyAt: readonly number[];
  flyFor: number;
}) {
  return (
    <>
      {FRIENDS.map((f, i) => {
        const from = AROUND[i];
        const row = {
          x: GROUP_ROWS.left + 12 + GROUP_ROWS.face / 2,
          y: GROUP_ROWS.top + (i + 1) * GROUP_ROWS.height + GROUP_ROWS.height / 2,
        };
        const wait = flyAt[i] - popAt[i];
        const whole = wait + flyFor;
        const pop = 0.32 / whole;
        const left = wait / whole;
        return (
          <motion.div
            key={f.id}
            className="absolute rounded-full shadow-xl shadow-black/25"
            style={{ left: -BIG / 2, top: -BIG / 2, width: BIG, height: BIG }}
            initial={{ x: from.x, y: from.y + 26, scale: 0, opacity: 0 }}
            animate={{
              // In with a small overshoot, drifting while it waits, then into its row.
              x: [from.x, from.x, from.x, row.x],
              y: [from.y + 26, from.y, from.y + from.drift, row.y],
              scale: [0, 1, 1, GROUP_ROWS.face / BIG],
              opacity: [0, 1, 1, 1],
            }}
            transition={{
              delay: popAt[i],
              duration: whole,
              times: [0, pop, left, 1],
              ease: [[0.2, 1.5, 0.4, 1], "easeInOut", [0.5, 0, 0.3, 1]],
            }}
          >
            <Face name={f.name} color={f.color} size={BIG} />
          </motion.div>
        );
      })}
    </>
  );
}
