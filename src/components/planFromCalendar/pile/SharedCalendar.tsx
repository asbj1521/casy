import { useCallback, useMemo } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";

import { MonthLayer } from "@/components/swipe/MonthView";
import type { GridItem } from "@/lib/monthGrid";
import { PILE_OPACITY } from "@/lib/paperPile";
import { type Frame } from "./shared";

/**
 * The pile once pressed, as one calendar: everyone's busy time together over
 * every month the listed dates are in, on the same glass, the free days lit.
 * Drawn in place of the stacked layers once they lie aligned (lighter on a
 * phone than a layer per person per month), and moved by `scroll` alone
 * (never scrolled by hand): the list scrolls it to lift each date out.
 */
export default function SharedCalendar({
  frame,
  months,
  friends,
  shine,
  scroll,
}: {
  frame: Frame;
  months: number[];
  friends: { profileId: string; items: GridItem[]; color: string }[];
  shine: ReadonlySet<number>;
  scroll: MotionValue<number>;
}) {
  const y = useTransform(scroll, (v) => -v);
  const items = useMemo(() => friends.flatMap((f) => f.items), [friends]);
  const colors = useMemo(() => new Map(friends.map((f) => [f.profileId, f.color])), [friends]);
  const colorOf = useCallback((id: string) => colors.get(id) ?? "", [colors]);
  return (
    <div
      data-shared
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-40 overflow-hidden rounded-t-[28px] border border-b-0"
      style={{
        top: frame.top,
        bottom: "var(--tab-bar-height)",
        backgroundColor: `rgb(var(--glass-tint) / ${PILE_OPACITY})`,
        borderColor: "rgb(var(--glass-edge))",
      }}
    >
      <motion.div style={{ y, marginLeft: frame.left, width: frame.width }}>
        {months.map((m) => (
          <MonthLayer key={m} month={m} items={items} colorOf={colorOf} shine={shine} />
        ))}
      </motion.div>
    </div>
  );
}
