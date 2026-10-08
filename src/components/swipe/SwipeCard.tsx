import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Check, Clock, Meh, X } from "lucide-react";

import type { EventResponse } from "@/api/events";
import { useT } from "@/i18n/lang";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/*
 * The swipe card's mechanics (#74), shared by a vote's deck (DateDeck) and
 * the phone flow's deck before sending (#101): the card that follows the
 * thumb, the three answer buttons, and the icon for an answer. What a date
 * runs into in your own calendar is clash.ts.
 */

/** How far a card must be dragged (px, with a little of its speed) to count as an answer. */
const ANSWER_AT = 110;

/** Which way a card leaves: its answer, or "back" when stepping to the date before. */
export type Exit = EventResponse | "back";

/** The card on top: follows the thumb, tilts, shows the answer it's heading for. */
export function SwipeCard({
  exitTo,
  onAnswer,
  draggable,
  children,
}: {
  exitTo: Exit;
  onAnswer: (response: EventResponse) => void;
  /** A phone's card follows the thumb; a computer's is answered by buttons and keys. */
  draggable: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-14, 0, 14]);
  const yes = useTransform(x, [24, ANSWER_AT], [0, 1]);
  const no = useTransform(x, [-ANSWER_AT, -24], [1, 0]);
  const maybe = useTransform(y, [-ANSWER_AT, -24], [1, 0]);

  // Which answer letting go would give now: a tick under the thumb on entering one.
  const heading = useRef<EventResponse | null>(null);
  const zone = (dx: number, dy: number): EventResponse | null =>
    dx > ANSWER_AT
      ? "accepted"
      : dx < -ANSWER_AT
        ? "declined"
        : dy < -ANSWER_AT && Math.abs(dx) < ANSWER_AT
          ? "maybe"
          : null;
  const track = () => {
    const now = zone(x.get(), y.get());
    if (now && now !== heading.current) haptic("tick");
    heading.current = now;
  };
  useMotionValueEvent(x, "change", track);
  useMotionValueEvent(y, "change", track);

  // Off the screen on a phone; on a computer just out of the card's own room.
  const away = draggable ? 640 : 120;
  const variants = {
    enter: { scale: 0.96, y: 8, opacity: 0.6 },
    center: { scale: 1, y: 0, opacity: 1 },
    exit: (to: Exit) =>
      reduceMotion || to === "back"
        ? { opacity: 0, scale: 0.96, transition: { duration: 0.15 } }
        : to === "accepted"
          ? { x: away, rotate: 18, opacity: 0, transition: { duration: 0.35 } }
          : to === "declined"
            ? { x: -away, rotate: -18, opacity: 0, transition: { duration: 0.35 } }
            : { y: -away, opacity: 0, transition: { duration: 0.35 } },
  };

  return (
    <motion.div
      className={cn(
        "absolute inset-0 z-10",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
      )}
      style={{ x, y, rotate: reduceMotion ? 0 : rotate }}
      drag={draggable}
      dragSnapToOrigin
      dragElastic={0.85}
      custom={exitTo}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      onDragEnd={(_, info) => {
        // A flick counts as much as a long drag.
        const answer = zone(
          info.offset.x + info.velocity.x * 0.15,
          info.offset.y + info.velocity.y * 0.15,
        );
        heading.current = null;
        if (answer) onAnswer(answer);
      }}
    >
      {children}
      {/* The answer it's heading for, stamped on as it gets there. */}
      <motion.span
        aria-hidden
        style={{ opacity: yes }}
        className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-lg border-[3px] border-emerald-500 px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide text-emerald-600"
      >
        {t.swipe.can}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: no }}
        className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-lg border-[3px] border-rose-500 px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide text-rose-600"
      >
        {t.swipe.cant}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: maybe }}
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg border-[3px] border-amber-500 px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide text-amber-600"
      >
        {t.swipe.rather}
      </motion.span>
    </motion.div>
  );
}

export function AnswerIcon({ answer }: { answer: EventResponse | undefined | null }) {
  if (answer === "accepted") return <Check className="h-3 w-3" />;
  if (answer === "maybe") return <Meh className="h-3 w-3" />;
  if (answer === "declined") return <X className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

/** The three answers as buttons, Tinder-style: can't, rather not (smaller), can. */
export function AnswerButtons({
  onAnswer,
  screen,
}: {
  onAnswer: (response: EventResponse) => void;
  screen: boolean;
}) {
  const t = useT();
  const base =
    "flex items-center justify-center rounded-full border-2 bg-card shadow-md transition active:scale-90";
  return (
    <div className={cn("flex items-start justify-center gap-6", screen ? "py-3" : "mt-4")}>
      {(
        [
          ["declined", X, "h-16 w-16 border-rose-200 text-rose-600", "h-8 w-8", t.swipe.cant],
          [
            "maybe",
            Meh,
            "mt-2 h-12 w-12 border-amber-200 text-amber-600",
            "h-6 w-6",
            t.swipe.rather,
          ],
          [
            "accepted",
            Check,
            "h-16 w-16 border-emerald-200 text-emerald-600",
            "h-8 w-8",
            t.swipe.can,
          ],
        ] as const
      ).map(([response, Icon, size, iconSize, label]) => (
        <div key={response} className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onAnswer(response)}
            aria-label={t.swipe.answerLong[response]}
            className={cn(base, size)}
          >
            <Icon className={iconSize} strokeWidth={2.5} />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
