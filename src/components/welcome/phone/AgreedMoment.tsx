import { motion } from "framer-motion";

import Avatar from "@/components/ui/Avatar";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline } from "@/lib/format";
import type { VoteEvent } from "@/lib/vote";
import { localDate } from "@/lib/zone";
import { dayCell } from "./dayCell";
import { colorOf, FRIENDS, TZ } from "./demo";
import { SCREEN } from "./geometry";

/** The card over the month, in the screen's pixels. */
const CARD = { left: 20, top: 262, width: SCREEN.width - 40, height: 222 };
/** The circle the card collapses into, and the day number's circle it ends as. */
const BALL = 60;
const DAY = 32;
/** How long it is in the air: not quick, so you can follow it. */
export const FLIGHT_S = 1.25;

/** A burst on landing: bits in everyone's colours and Casy's orange, thrown out and falling. */
const BITS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 3) * 0.2;
  const reach = 62 + (i % 4) * 16;
  return {
    x: Math.cos(angle) * reach,
    y: Math.sin(angle) * reach - 18,
    spin: (i % 2 ? 1 : -1) * 220,
  };
});
const BIT_COLORS = ["234, 88, 12", ...FRIENDS.map((f) => colorOf(f.id))];

/**
 * A date agreed (#228), said as the app says it (AgreedCard): the month dimmed
 * behind a card with the event, its date and everyone's faces. Then the card
 * collapses into an orange circle (`stage`), which rises off to the side before
 * swinging round and down onto its day, lands with a squash, a ring and a burst
 * of confetti, and stays as the day's orange circle.
 */
export default function AgreedMoment({
  event,
  day,
  month,
  stage,
}: {
  event: VoteEvent;
  /** The date's midnight. */
  day: number;
  month: number;
  stage: "card" | "collapsed" | "flying" | "landed";
}) {
  const t = useT();
  const { lang } = useLang();
  const date = event.candidates.find((d) => d.id === String(day)) ?? event.candidates[0];
  const headline = formatHeadline(event.settings, date, lang, t);
  const cell = dayCell(day, month, lang);
  const isCard = stage === "card";
  const landed = stage === "landed";
  // All from where the circle's middle is, once collapsed.
  const from = { x: SCREEN.width / 2, y: CARD.top + CARD.height / 2 };
  const path =
    stage === "flying" || landed
      ? {
          // Up and away from the day first, then round and down onto it.
          x: [from.x, from.x + 62, from.x + 40, cell.x],
          y: [from.y, from.y - 110, from.y - 150, cell.y],
          scale: [1, 1.08, 1, DAY / BALL],
        }
      : { x: from.x, y: from.y, scale: 1 };
  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: isCard ? 1 : 0 }}
        transition={{ duration: 0.35 }}
      />
      {/* The ball's path; the card lives inside it, centred on its middle. */}
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: from.x, y: from.y, scale: 1 }}
        animate={path}
        transition={
          stage === "flying" || landed
            ? {
                duration: FLIGHT_S,
                times: [0, 0.34, 0.5, 1],
                ease: ["easeOut", "easeInOut", [0.55, 0, 0.85, 0.4]],
              }
            : { duration: 0 }
        }
      >
        <motion.div
          className="absolute overflow-hidden border"
          initial={{
            opacity: 0,
            scale: 0.85,
            width: CARD.width,
            height: CARD.height,
            x: -CARD.width / 2,
            y: -CARD.height / 2,
            borderRadius: 28,
          }}
          animate={
            isCard
              ? {
                  opacity: 1,
                  scale: 1,
                  width: CARD.width,
                  height: CARD.height,
                  x: -CARD.width / 2,
                  y: -CARD.height / 2,
                  borderRadius: 28,
                }
              : {
                  opacity: 1,
                  // The landing: squashed flat for an instant, then round.
                  scale: landed ? [1.5, 0.82, 1.08, 1] : 1,
                  width: BALL,
                  height: BALL,
                  x: -BALL / 2,
                  y: -BALL / 2,
                  borderRadius: BALL / 2,
                }
          }
          transition={
            isCard
              ? { type: "spring", stiffness: 380, damping: 26 }
              : landed
                ? { duration: 0.42, times: [0, 0.35, 0.7, 1] }
                : { duration: 0.42, ease: [0.5, 0, 0.2, 1] }
          }
          style={{ boxShadow: "0 16px 40px -10px rgb(0 0 0 / 0.4)" }}
        >
          {/* The card's face and the circle's fill, one giving way to the other. */}
          <div className="absolute inset-0 bg-card" />
          <motion.div
            className="absolute inset-0 bg-cta"
            initial={{ opacity: 0 }}
            animate={{ opacity: isCard ? 0 : 1 }}
            transition={{ delay: 0.08, duration: 0.25 }}
          />
          <motion.div
            className="absolute left-0 top-0 p-5"
            style={{ width: CARD.width }}
            initial={false}
            animate={{ opacity: isCard ? 1 : 0 }}
            transition={{ duration: 0.14 }}
          >
            <p className="text-[12px] font-bold uppercase tracking-wide text-primary">
              {t.homeVote.everyone}
            </p>
            <p className="mt-1 text-[17px] font-semibold text-foreground">{event.title}</p>
            <p className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-tight text-foreground">
              {headline.lines.join(" ")}
            </p>
            <p className="mt-1 text-[17px] text-foreground">{headline.time}</p>
            <ul className="mt-3 flex -space-x-2">
              {event.invitees.map((p, i) => (
                <li key={p.profileId}>
                  <Avatar name={p.name} index={i} size="md" className="ring-2 ring-card" />
                </li>
              ))}
            </ul>
          </motion.div>
          {/* Landed: the day's number, on the circle it has become. */}
          {landed && (
            <motion.span
              className="absolute inset-0 flex items-center justify-center font-semibold text-white"
              style={{ fontSize: (18 * BALL) / DAY }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.06, duration: 0.15 }}
            >
              {localDate(day, TZ).day}
            </motion.span>
          )}
        </motion.div>
      </motion.div>
      {landed && (
        <div
          className="absolute left-0 top-0"
          style={{ transform: `translate(${cell.x}px, ${cell.y}px)` }}
        >
          {/* The shock of it: one ring going out. */}
          <motion.span
            className="absolute rounded-full border-[3px] border-primary"
            style={{ width: 40, height: 40, left: -20, top: -20 }}
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 3.2, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          {BITS.map((bit, i) => (
            <motion.span
              key={i}
              className="absolute h-[9px] w-[5px] rounded-[1px]"
              style={{ background: `rgb(${BIT_COLORS[i % BIT_COLORS.length]})`, left: -2, top: -4 }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              animate={{
                x: bit.x,
                y: [0, bit.y, bit.y + 46],
                rotate: bit.spin,
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.95, ease: "easeOut", times: [0, 0.5, 1] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
