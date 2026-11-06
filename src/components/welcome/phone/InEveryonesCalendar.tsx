import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { useLang, useT } from "@/i18n/lang";
import { dayOfWeek, localDate } from "@/lib/zone";
import { dayCell } from "./dayCell";
import { FRIENDS, TZ } from "./demo";
import { SCREEN } from "./geometry";
import { Face } from "./PhoneGroup";

/** Sizes on the stage, in px: they stay the same whatever size the phone stands at. */
const FACE_PX = 54;
const TILE_PX = { width: 34, height: 38 };
const TICK_PX = 18;
/** How far a tile and its tick reach past their face, so the column leaves room for them. */
const OVERHANG_PX = 15;
const EDGE_PX = 5;
/** Which side of the phone each friend stands, and how far down the screen. */
const PLACES = [
  { side: -1, y: 190 },
  { side: 1, y: 110 },
  { side: -1, y: 560 },
  { side: 1, y: 420 },
  { side: 1, y: 720 },
];
const POP = 0.11;
const SEND_AT = 0.45;
const SEND_EVERY = 0.13;
const SEND_FOR = 0.55;

/**
 * The end of it all (#228): the friends from the start are back round the phone,
 * and the agreed date shoots out from its day to each of them, arriving as a
 * calendar tile with the date on it (the one Aftaler's rows have) and a tick. So
 * it is plain the date is in everyone's calendar, not only yours.
 */
export default function InEveryonesCalendar({
  day,
  month,
  scale,
  stageWidth,
  leaving,
}: {
  /** The agreed date's midnight. */
  day: number;
  month: number;
  /** How the phone stands on the stage: its pixels to the stage's. */
  scale: number;
  stageWidth: number;
  leaving: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const cell = dayCell(day, month, lang);
  const number = localDate(day, TZ).day;
  const weekday = t.weekdaysShort[dayOfWeek(day, TZ)];
  // From the stage's pixels to the phone's, in which all this is laid out.
  const px = (n: number) => n / scale;
  const FACE = px(FACE_PX);
  // The stage's edges, as seen from the screen's own left edge.
  const left = SCREEN.width / 2 - px(stageWidth / 2);
  const right = SCREEN.width / 2 + px(stageWidth / 2);
  const leftX = left + px(EDGE_PX) + FACE / 2;
  const rightX = right - px(EDGE_PX + OVERHANG_PX) - FACE / 2;
  return (
    <motion.div
      className="absolute inset-0"
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.25 }}
    >
      {FRIENDS.map((f, i) => {
        const at = { x: PLACES[i].side < 0 ? leftX : rightX, y: PLACES[i].y };
        const sent = SEND_AT + i * SEND_EVERY;
        return (
          <div key={f.id}>
            {/* The date on its way out to them. */}
            <motion.span
              className="absolute rounded-full bg-cta"
              style={{ width: px(16), height: px(16), left: -px(8), top: -px(8) }}
              initial={{ x: cell.x, y: cell.y, scale: 0.6, opacity: 0 }}
              animate={{
                x: at.x,
                y: at.y,
                scale: [0.6, 1.2, 0.8],
                opacity: [1, 1, 0],
              }}
              transition={{
                delay: sent,
                duration: SEND_FOR,
                // Different paces across and down, so each goes in a curve.
                x: { delay: sent, duration: SEND_FOR, ease: [0.3, 0, 0.5, 1] },
                y: { delay: sent, duration: SEND_FOR, ease: [0.5, 0, 0.9, 0.6] },
                opacity: { delay: sent, duration: SEND_FOR, times: [0, 0.9, 1] },
              }}
            />
            {/* Their face, then the date arriving on it. */}
            <motion.div
              className="absolute rounded-full shadow-xl shadow-black/25"
              style={{ left: at.x - FACE / 2, top: at.y - FACE / 2 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * POP, type: "spring", stiffness: 300, damping: 18 }}
            >
              <Face name={f.name} color={f.color} size={FACE} />
              <motion.div
                className="absolute flex flex-col items-center justify-center overflow-hidden border bg-card shadow-lg shadow-black/25"
                style={{
                  width: px(TILE_PX.width),
                  height: px(TILE_PX.height),
                  right: -px(OVERHANG_PX),
                  bottom: -px(17),
                  borderRadius: px(9),
                }}
                initial={{ scale: 0, rotate: -14 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: sent + SEND_FOR - 0.04,
                  type: "spring",
                  stiffness: 420,
                  damping: 16,
                }}
              >
                <span
                  className="font-bold uppercase leading-none text-primary"
                  style={{ fontSize: px(9) }}
                >
                  {weekday}
                </span>
                <span
                  className="font-bold leading-none text-foreground"
                  style={{ fontSize: px(20), marginTop: px(1) }}
                >
                  {number}
                </span>
              </motion.div>
              <motion.span
                className="absolute flex items-center justify-center rounded-full bg-emerald-500 text-white"
                style={{
                  width: px(TICK_PX),
                  height: px(TICK_PX),
                  right: -px(OVERHANG_PX + 5),
                  bottom: px(TILE_PX.height - 17 - 7),
                  boxShadow: `0 0 0 ${px(1.5)}px hsl(var(--card))`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: sent + SEND_FOR + 0.14,
                  type: "spring",
                  stiffness: 520,
                  damping: 16,
                }}
              >
                <Check style={{ width: px(12), height: px(12) }} strokeWidth={3.5} />
              </motion.span>
            </motion.div>
          </div>
        );
      })}
    </motion.div>
  );
}
