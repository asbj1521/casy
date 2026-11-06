import { motion, type TargetAndTransition, type Transition } from "framer-motion";
import { ChevronRight, Vote } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { useLang, useT } from "@/i18n/lang";
import { formatHeadline } from "@/lib/format";
import type { VoteEvent } from "@/lib/vote";
import { localDate } from "@/lib/zone";
import { dayCell, LIST, rowTop } from "./dayCell";
import { colorOf, FRIENDS, TZ } from "./demo";
import { SCREEN } from "./geometry";
import { VotePanel } from "./PhoneVote";

/**
 * The one box that carries the second half of the animation (#228): the send
 * button becomes the "Svar på" pill, which grows into the vote's panel, which
 * becomes the agreed card, which collapses into a circle that lands on its day.
 * What it says changes; the box itself never goes away.
 */
export type BoxStage = "button" | "pill" | "panel" | "card" | "ball" | "flying" | "landed";

const CARD = { left: 20, top: 360, width: SCREEN.width - 40, height: 222 };
/** The circle the card collapses into, and the day number's circle it ends as. */
const BALL = 60;
const DAY = 32;
const BALL_FROM = { x: SCREEN.width / 2, y: CARD.top + CARD.height / 2 };
/** How long it is in the air. */
export const FLIGHT_S = 0.95;
/** How far the curve bends away from the straight line, in the screen's pixels. */
const BEND = 70;

/** Where the box is at each stage. The panel runs on past the screen's bottom, so only its top is round. */
const RECT: Record<
  BoxStage,
  { left: number; top: number; width: number; height: number; r: number }
> = (() => {
  const ball = {
    left: BALL_FROM.x - BALL / 2,
    top: BALL_FROM.y - BALL / 2,
    width: BALL,
    height: BALL,
    r: BALL / 2,
  };
  return {
    button: {
      left: LIST.left,
      top: rowTop(3) + 6,
      width: SCREEN.width - LIST.left * 2,
      height: 56,
      r: 28,
    },
    // Just above the home page's bottom buttons, as HomePill stands.
    pill: { left: 46, top: SCREEN.height - 124, width: SCREEN.width - 92, height: 44, r: 22 },
    panel: { left: 0, top: SCREEN.height - 316, width: SCREEN.width, height: 356, r: 28 },
    card: { ...CARD, r: 28 },
    ball,
    flying: ball,
    landed: ball,
  };
})();

/** A burst on landing: bits in everyone's colours and Casy's orange, thrown out and falling. */
const BITS = Array.from({ length: 40 }, (_, i) => {
  const angle = (i / 40) * Math.PI * 2 + (i % 3) * 0.2;
  const reach = 70 + (i % 5) * 34;
  return {
    x: Math.cos(angle) * reach,
    y: Math.sin(angle) * reach - 18,
    spin: (i % 2 ? 1 : -1) * 220,
  };
});
const BIT_COLORS = ["234, 88, 12", ...FRIENDS.map((f) => colorOf(f.id))];

/**
 * One smooth curve to the day, sampled: a bend to one side and straight in, with
 * no turning back on the way, slow off and quickening into the landing.
 */
function curveTo(to: { x: number; y: number }) {
  const dx = to.x - BALL_FROM.x;
  const dy = to.y - BALL_FROM.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = {
    x: BALL_FROM.x + dx / 2 - (dy / length) * BEND,
    y: BALL_FROM.y + dy / 2 + (dx / length) * BEND,
  };
  const x: number[] = [];
  const y: number[] = [];
  const scale: number[] = [];
  const STEPS = 18;
  for (let i = 0; i <= STEPS; i++) {
    const u = i / STEPS;
    const t = u * u * (2.2 - 1.2 * u);
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const c = t * t;
    x.push(a * BALL_FROM.x + b * control.x + c * to.x - BALL_FROM.x);
    y.push(a * BALL_FROM.y + b * control.y + c * to.y - BALL_FROM.y);
    scale.push(1 + (DAY / BALL - 1) * t);
  }
  return { x, y, scale };
}

/** What the box says at one stage: there while it is that, crossfading as it changes shape. */
function Face({
  shown,
  className,
  style,
  children,
}: {
  shown: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={shown ? { delay: 0.14, duration: 0.22 } : { duration: 0.12 }}
    >
      {children}
    </motion.div>
  );
}

export default function TravelBox({
  event,
  day,
  month,
  stage,
  pressed,
  answered,
}: {
  event: VoteEvent;
  /** The agreed date's midnight. */
  day: number;
  month: number;
  stage: BoxStage;
  /** Being pressed: the button or the pill gives a little under the finger. */
  pressed: boolean;
  answered: number;
}) {
  const t = useT();
  const { lang } = useLang();
  const date = event.candidates.find((d) => d.id === String(day)) ?? event.candidates[0];
  const headline = formatHeadline(event.settings, date, lang, t);
  const cell = dayCell(day, month, lang);
  const rect = RECT[stage];
  const flying = stage === "flying" || stage === "landed";
  const landed = stage === "landed";
  const isBall = stage === "ball" || flying;

  const path: TargetAndTransition = flying ? curveTo(cell) : { x: 0, y: 0, scale: 1 };
  const pathMove: Transition = flying ? { duration: FLIGHT_S, ease: "linear" } : { duration: 0 };
  const box: TargetAndTransition = {
    opacity: 1,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    borderRadius: rect.r,
    // Landing: squashed flat for an instant, then round. Pressed: a small give.
    scale: landed ? [1.5, 0.82, 1.08, 1] : pressed ? [1, 0.94, 1] : 1,
  };
  return (
    <div className="absolute inset-0">
      {/* The month dims behind the card, as AgreedCard's does. */}
      <motion.div
        className="absolute inset-0 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage === "card" ? 1 : 0 }}
        transition={{ duration: 0.35 }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: `${BALL_FROM.x}px ${BALL_FROM.y}px` }}
        initial={false}
        animate={path}
        transition={pathMove}
      >
        <motion.div
          className="absolute overflow-hidden border bg-card"
          style={{ boxShadow: "0 14px 40px -12px rgb(0 0 0 / 0.38)" }}
          initial={{
            opacity: 0,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius: rect.r,
          }}
          animate={box}
          transition={{
            type: "spring",
            stiffness: 170,
            damping: 24,
            opacity: { duration: 0.3 },
            scale: landed
              ? { duration: 0.42, times: [0, 0.35, 0.7, 1] }
              : { duration: 0.3, ease: "easeOut" },
          }}
        >
          <Face
            shown={stage === "button"}
            className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[17px] font-bold text-primary"
          >
            {t.planFromCalendar.suggest(event.candidates.length)}
          </Face>
          <Face
            shown={stage === "pill"}
            className="absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-semibold text-primary"
          >
            <Vote className="h-5 w-5 shrink-0" />
            {t.homeVote.answer(event.title)}
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Face>
          {(stage === "pill" || stage === "panel" || stage === "card") && (
            <Face
              shown={stage === "panel"}
              className="absolute left-0 top-0"
              style={{ width: SCREEN.width }}
            >
              <VotePanel event={event} answered={answered} />
            </Face>
          )}
          {/* The card's face, and the circle's fill giving way to it. */}
          <motion.div
            className="absolute inset-0 bg-cta"
            initial={{ opacity: 0 }}
            animate={{ opacity: isBall ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          />
          <Face
            shown={stage === "card"}
            className="absolute left-0 top-0 p-5"
            style={{ width: CARD.width }}
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
          </Face>
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
          {/* The event itself, under its number, solid while the month dims around it. */}
          <motion.span
            className="absolute truncate rounded-[4px] bg-cta px-1 text-[11px] font-semibold leading-[17px] text-white"
            style={{ left: -25, top: 21, width: 50, height: 17 }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.25 }}
          >
            {event.title}
          </motion.span>
          {/* The shock of it: two rings going out. */}
          {[0, 0.12].map((delay) => (
            <motion.span
              key={delay}
              className="absolute rounded-full border-[3px] border-primary"
              style={{ width: 40, height: 40, left: -20, top: -20 }}
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ delay, duration: 0.8, ease: "easeOut" }}
            />
          ))}
          {BITS.map((bit, i) => (
            <motion.span
              key={i}
              className="absolute h-[11px] w-[6px] rounded-[1px]"
              style={{ background: `rgb(${BIT_COLORS[i % BIT_COLORS.length]})`, left: -2, top: -4 }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              animate={{
                x: bit.x,
                y: [0, bit.y, bit.y + 90],
                rotate: bit.spin,
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1.3, ease: "easeOut", times: [0, 0.45, 1] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
