import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { NoShortName } from "@/components/planFromCalendar/pile/PileTitle";
import ThrownLayer from "@/components/planFromCalendar/pile/ThrownLayer";
import type { Frame } from "@/components/planFromCalendar/pile/shared";
import { MonthLayer } from "@/components/swipe/MonthView";
import { useLang, useT } from "@/i18n/lang";
import { capitalize, monthName } from "@/lib/format";
import type { GridItem } from "@/lib/monthGrid";
import { layerAlpha, pileTimeline, sheetTilt } from "@/lib/paperPile";
import type { SearchAgainPile as Pile } from "@/lib/searchAgain";

/** The pile names its month once, over yours: no short name on each layer (as Planlæg's, #162). */
const NO_SHORT_NAME = <NoShortName />;

/**
 * The search for a vote's new dates, seen (#240): the paper pile of Planlæg
 * (#126), picked up where it was left. Your calendar, with the calendars the
 * vote already searched lying on it, crooked, as they were thrown then; then
 * the calendars of the people just added thrown on top, one after another, as
 * Planlæg throws them (ThrownLayer); then "Finder nye datoer" until the new
 * dates are in, when it fades away over the vote showing them. With nobody
 * added, the pile is simply searched again. Over everything, sheets included,
 * and nothing on it can be tapped. Reduced motion shows none of it.
 */
export default function SearchAgainPile({ pile }: { pile: Pile }) {
  const t = useT();
  const { lang } = useLang();
  const base = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const before = pile.layers.filter((l) => !l.isNew);
  const added = pile.layers.filter((l) => l.isNew);
  const timeline = useMemo(() => pileTimeline(added.length, 0, 0.5), [added.length]);
  const alpha = layerAlpha(pile.layers.length);

  // The layers land exactly on your calendar: measured once it is drawn.
  useLayoutEffect(() => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFrame({
      month: pile.month,
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      title: null,
    });
  }, [pile.month]);

  const sheet = (items: GridItem[], colorOf: (id: string) => string) => (
    <div className="px-1 pb-2 pt-12">
      <MonthLayer month={pile.month} items={items} colorOf={colorOf} heading={NO_SHORT_NAME} />
    </div>
  );

  return createPortal(
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden bg-background/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)]">
        <div
          ref={base}
          className="relative rounded-[28px] border bg-card"
          style={{ borderColor: "rgb(var(--glass-edge))" }}
        >
          <p className="absolute left-4 top-3 text-[1.25rem] font-bold text-foreground">
            {capitalize(monthName(pile.month, lang))}
          </p>
          {sheet(pile.you.items, pile.you.colorOf)}
        </div>
      </div>

      {frame &&
        before.map((layer, k) => {
          const tilt = sheetTilt(k + 1);
          return (
            <div
              key={layer.profileId}
              className="absolute rounded-[28px] border"
              style={{
                top: frame.top,
                left: frame.left,
                width: frame.width,
                transform: `translate(${tilt.x}px, ${tilt.y}px) rotate(${tilt.rotate}deg)`,
                backgroundColor: `rgb(var(--glass-tint) / ${alpha})`,
                borderColor: "rgb(var(--glass-edge))",
              }}
            >
              {sheet(layer.items, layer.colorOf)}
            </div>
          );
        })}

      {frame &&
        added.map((layer, i) => (
          <ThrownLayer
            key={layer.profileId}
            k={before.length + i}
            frame={frame}
            land={timeline.lands[i]}
            landed={before.length + added.length}
            pressed={false}
            revealed={false}
            alpha={alpha}
            name={layer.name}
            color={layer.color}
          >
            {sheet(layer.items, layer.colorOf)}
          </ThrownLayer>
        ))}

      <motion.p
        className="glass absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+2rem)] mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[0.9375rem] font-medium text-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: timeline.lands.at(-1) ? timeline.lands.at(-1)!.at + 0.5 : 0.4 }}
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {t.searchAgain.finding}
      </motion.p>
    </motion.div>,
    document.body,
  );
}
