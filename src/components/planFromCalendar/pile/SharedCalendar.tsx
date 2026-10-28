import { useCallback, useMemo, useRef, useState } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";

import { MonthLayer } from "@/components/swipe/MonthView";
import type { GridItem } from "@/lib/monthGrid";
import { MONTH_LABEL_PX } from "@/lib/monthScroll";
import { PILE_OPACITY } from "@/lib/paperPile";
import PileTitle, { NoShortName } from "./PileTitle";
import { type Frame, titleBand } from "./shared";

/**
 * The pile once pressed, as one calendar: everyone's busy time together over
 * every month the listed dates are in, on the same glass, the free days lit.
 * Drawn in place of the stacked layers once they lie aligned (lighter on a
 * phone than a layer per person per month), and moved by `scroll` alone
 * (never scrolled by hand): the list scrolls it to lift each date out. Its
 * top band names the month at the top of the view, as My calendar's header
 * does, in place of a small name over each month's 1st (#162).
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
  const band = titleBand(frame);

  // The month at the top of the view: the last whose first week has come up
  // under the band. Only a change of month redraws, however fast it scrolls.
  const sheet = useRef<HTMLDivElement>(null);
  const [named, setNamed] = useState(months[0] ?? frame.month);
  useMotionValueEvent(scroll, "change", (v) => {
    let current = months[0];
    for (const el of sheet.current?.querySelectorAll<HTMLElement>("[data-month]") ?? []) {
      if (el.offsetTop + MONTH_LABEL_PX <= v + 2) current = Number(el.dataset.month);
    }
    setNamed(current);
  });

  return (
    <div
      data-shared
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-40 flex flex-col overflow-hidden rounded-t-[28px] border border-b-0"
      style={{
        top: frame.top - band,
        bottom: 0,
        backgroundColor: `rgb(var(--glass-tint) / ${PILE_OPACITY})`,
        borderColor: "rgb(var(--glass-edge))",
      }}
    >
      {/* Opaque: My calendar's own month name, under it, may be another month. */}
      <PileTitle frame={frame} month={named} opaque />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div ref={sheet} style={{ y, marginLeft: frame.left, width: frame.width }}>
          {months.map((m) => (
            <MonthLayer
              key={m}
              month={m}
              items={items}
              colorOf={colorOf}
              shine={shine}
              heading={band > 0 ? <NoShortName /> : undefined}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
