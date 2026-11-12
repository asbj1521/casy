import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, BellRing } from "lucide-react";

import { remindVoters } from "@/api/events";
import GlassButton from "@/components/ui/GlassButton";
import Notice from "@/components/ui/Notice";
import { useEventChange } from "@/hooks/useEventChange";
import { useT } from "@/i18n/lang";
import { haptic } from "@/lib/haptics";
import type { VoteEvent } from "@/lib/vote";

/** A reminder goes out at most once a day (remind_vote on the server). */
const DAY_MS = 24 * 3_600_000;

/**
 * "Påmind" (a vote's suggester only): a notification to everyone the vote
 * still waits for, the faces apart at the end of the row under it, beside the
 * event's name and time. Once a day
 * at most, as the server keeps it: pressed, the bell rings and the button
 * rests as "Påmindet" until a day has passed. Only for an open vote with
 * someone still to answer (`waiting`).
 */
export default function RemindButton({
  event,
  waiting,
  className,
}: {
  event: VoteEvent;
  /** How many the vote still waits for (stillToAnswer). */
  waiting: number;
  className?: string;
}) {
  const t = useT();
  const words = t.remind;
  const reduce = useReducedMotion();
  const remind = useEventChange(() => remindVoters(event.id));
  // The clock as the button appeared: it rests for the day the server keeps.
  const [now] = useState(() => Date.now());
  const lastAt = event.remindedAt ? Date.parse(event.remindedAt) : null;
  const done = remind.isSuccess || (lastAt !== null && now - lastAt < DAY_MS);
  if (!event.createdBy.isYou || event.status !== "pending" || waiting === 0) return null;

  return (
    <div className={className}>
      <GlassButton
        size="sm"
        busy={remind.isPending}
        disabled={done}
        onClick={() => {
          haptic("select");
          remind.mutate();
        }}
      >
        {/* The bell rings as it goes out, then rests: shown, not said. */}
        {!remind.isPending &&
          (done ? (
            <motion.span
              key="rang"
              initial={reduce ? false : { rotate: 0 }}
              animate={reduce ? undefined : { rotate: [0, -18, 16, -12, 8, -4, 0] }}
              transition={{ duration: 0.7 }}
              className="inline-flex"
            >
              <BellRing aria-hidden className="h-4 w-4" />
            </motion.span>
          ) : (
            <Bell aria-hidden className="h-4 w-4" />
          ))}
        {/* At the largest text the bell alone, so the event's name keeps its room. */}
        <span className="large-text:sr-only">{done ? words.done : words.button(waiting)}</span>
      </GlassButton>
      {remind.isError && (
        <Notice tone="error" bare className="mt-2">
          {remind.error.message}
        </Notice>
      )}
    </div>
  );
}
