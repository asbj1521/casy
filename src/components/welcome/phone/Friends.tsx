import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { useT } from "@/i18n/lang";
import { dayOfWeek, localDate } from "@/lib/zone";
import { FRIENDS, TZ } from "./demo";
import { GROUP_ROWS, SCREEN } from "./geometry";
import { Face } from "./PhoneGroup";

/** Sizes on the stage, in px: the same whatever size the phone stands at. */
const FACE_PX = 58;
const TILE_PX = { width: 34, height: 38 };
const TICK_PX = 18;
/** How far a tile and its tick reach past their face, so the column leaves room for them. */
const OVERHANG_PX = 15;
const EDGE_PX = 5;
/** Which side of the phone each friend stands, and how far down the stage. */
const PLACES = [
  { side: -1, y: 0.34 },
  { side: 1, y: 0.26 },
  { side: -1, y: 0.74 },
  { side: 1, y: 0.55 },
  { side: 1, y: 0.84 },
];
/** How long the date takes to reach a friend. */
export const SEND_FOR = 0.55;
export const FLY_FOR = 0.42;

/** Where a friend is: not there, standing round the phone, or flying into their row on it. */
export type FriendState = "gone" | "around" | "row";

/**
 * The five friends (#228), the one thing that opens the animation and ends it,
 * and the same faces in both: they live on the stage, outside the phone, so
 * they can stay exactly where they are as the phone changes under them. At the
 * end the agreed date goes out to each, and they stand with a calendar tile and
 * a tick. The tiles go, the phone grows back and its screen becomes the group,
 * and the faces, which never moved, fly into their rows: there is no cut in the
 * loop. Only the very first time do they pop up from nothing.
 */
export default function Friends({
  width,
  height,
  top,
  scale,
  framed,
  cell,
  day,
  states,
  sent,
  tiles,
}: {
  width: number;
  height: number;
  /** Where the room under the headline begins: the faces stand in that, never behind the words. */
  top: number;
  /** How the phone stands when it fills the stage, where the rows are. */
  scale: number;
  /** How it stands under a headline, where the date goes out from. */
  framed: { y: number; scale: number };
  /** The agreed day's place on the screen, in the screen's pixels. */
  cell: { x: number; y: number };
  /** The agreed date's midnight. */
  day: number;
  states: FriendState[];
  /** Whose date has left for them. */
  sent: boolean[];
  /** Whose date is in their calendar: the tile and the tick are showing. */
  tiles: boolean[];
}) {
  const t = useT();
  const leftX = EDGE_PX + FACE_PX / 2;
  const rightX = width - EDGE_PX - OVERHANG_PX - FACE_PX / 2;
  const from = {
    x: width / 2 + (cell.x - SCREEN.width / 2) * framed.scale,
    y: height / 2 + framed.y + (cell.y - SCREEN.height / 2) * framed.scale,
  };
  const number = localDate(day, TZ).day;
  const weekday = t.weekdaysShort[dayOfWeek(day, TZ)];
  return (
    <div className="absolute inset-0">
      {FRIENDS.map((f, i) => {
        const place = {
          x: PLACES[i].side < 0 ? leftX : rightX,
          y: top + PLACES[i].y * (height - top),
        };
        const row = {
          x: width / 2 + (GROUP_ROWS.left + 12 + GROUP_ROWS.face / 2 - SCREEN.width / 2) * scale,
          y:
            height / 2 +
            (GROUP_ROWS.top +
              (i + 1) * GROUP_ROWS.height +
              GROUP_ROWS.height / 2 -
              SCREEN.height / 2) *
              scale,
        };
        const state = states[i];
        const at = state === "row" ? row : place;
        return (
          <div key={f.id}>
            {sent[i] && !tiles[i] && (
              /* The date on its way out; different paces across and down make it a curve. */
              <motion.span
                className="absolute left-0 top-0 rounded-full bg-cta"
                style={{ width: 16, height: 16, marginLeft: -8, marginTop: -8 }}
                initial={{ x: from.x, y: from.y, scale: 0.6 }}
                animate={{ x: place.x, y: place.y, scale: 1.4 }}
                transition={{
                  duration: SEND_FOR,
                  x: { duration: SEND_FOR, ease: [0.3, 0, 0.5, 1] },
                  y: { duration: SEND_FOR, ease: [0.5, 0, 0.9, 0.6] },
                }}
              />
            )}
            <motion.div
              className="absolute left-0 top-0 rounded-full shadow-xl shadow-black/25"
              style={{ marginLeft: -FACE_PX / 2, marginTop: -FACE_PX / 2 }}
              initial={{ x: place.x, y: place.y, scale: 0, opacity: 0 }}
              animate={{
                x: at.x,
                y: at.y,
                scale:
                  state === "gone" ? 0 : state === "row" ? (GROUP_ROWS.face * scale) / FACE_PX : 1,
                opacity: state === "gone" ? 0 : 1,
              }}
              transition={
                state === "row"
                  ? { duration: FLY_FOR, ease: [0.5, 0, 0.3, 1] }
                  : state === "around"
                    ? {
                        // Back from a row, it is put in its place at once, unseen, then grows.
                        x: { duration: 0 },
                        y: { duration: 0 },
                        opacity: { duration: 0 },
                        scale: { type: "spring", stiffness: 340, damping: 17 },
                      }
                    : { duration: 0 }
              }
            >
              <Face name={f.name} color={f.color} size={FACE_PX} />
              <motion.div
                className="absolute flex flex-col items-center justify-center overflow-hidden rounded-[9px] border bg-card shadow-lg shadow-black/25"
                style={{
                  width: TILE_PX.width,
                  height: TILE_PX.height,
                  right: -OVERHANG_PX,
                  bottom: -17,
                }}
                initial={{ scale: 0, rotate: -14 }}
                animate={{ scale: tiles[i] ? 1 : 0, rotate: tiles[i] ? 0 : -14 }}
                transition={
                  tiles[i]
                    ? { delay: 0.05, type: "spring", stiffness: 420, damping: 16 }
                    : { duration: 0.2, ease: "easeIn" }
                }
              >
                <span className="text-[9px] font-bold uppercase leading-none text-primary">
                  {weekday}
                </span>
                <span className="mt-px text-[20px] font-bold leading-none text-foreground">
                  {number}
                </span>
              </motion.div>
              <motion.span
                className="absolute flex items-center justify-center rounded-full bg-emerald-500 text-white"
                style={{
                  width: TICK_PX,
                  height: TICK_PX,
                  right: -OVERHANG_PX - 5,
                  bottom: TILE_PX.height - 17 - 7,
                  boxShadow: "0 0 0 1.5px hsl(var(--card))",
                }}
                initial={{ scale: 0 }}
                animate={{ scale: tiles[i] ? 1 : 0 }}
                transition={
                  tiles[i]
                    ? { delay: 0.2, type: "spring", stiffness: 520, damping: 16 }
                    : { duration: 0.16, ease: "easeIn" }
                }
              >
                <Check className="h-3 w-3" strokeWidth={3.5} />
              </motion.span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
