import { useEffect, useMemo, useRef } from "react";

import { haptic } from "@/lib/haptics";

/**
 * An iOS-style looping scroll wheel. The options are repeated many times so the
 * user can spin freely; on settle we snap to the centred item, report it, and
 * seamlessly recenter to keep the loop effectively endless.
 *
 * Clicking works too: an item off-centre scrolls smoothly into the middle
 * (and is reported when it settles, like any scroll); the centred item,
 * which is already the choice, calls `onPick`, which closes the menu.
 */
export default function WheelPicker({
  options,
  value,
  onChange,
  onPick,
  driven = false,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (value: number) => void;
  /** Clicked the item already in the middle: done choosing. */
  onPick?: () => void;
  /**
   * Turned by the page, not the finger (#173: Casy filling in the Planlæg
   * sheet): a new value scrolls the wheel to it, and nothing is reported back.
   */
  driven?: boolean;
}) {
  const ITEM = 36;
  const VISIBLE = 5;
  // Enough repeats that no single fling can reach either end before the wheel
  // settles and recentres, without mounting a needless pile of DOM: from the
  // middle copy there are seven copies of runway each way (~6000px), several
  // times the distance a flick actually travels.
  const COPIES = 15;
  const len = options.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The option in the middle, so each one passing it clicks (#173).
  const centred = useRef<number | null>(null);
  const middleStart = Math.floor(COPIES / 2) * len;

  const list = useMemo(
    () => Array.from({ length: COPIES * len }, (_, i) => options[i % len]),
    [options, len],
  );

  // Centre the current value when the wheel first mounts.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const optIdx = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    el.scrollTop = (middleStart + optIdx) * ITEM;
    centred.current = optIdx;
    // Centred on the value only for a new list: scrolling the wheel is what
    // sets the value, and centring again then would fight the finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // Driven, the wheel rolls to each new value along the shortest way.
  useEffect(() => {
    const el = containerRef.current;
    if (!driven || !el) return;
    const optIdx = options.findIndex((o) => o.value === value);
    if (optIdx < 0) return;
    const at = Math.round(el.scrollTop / ITEM);
    const copy = Math.round((at - optIdx) / len);
    el.scrollTo({ top: (copy * len + optIdx) * ITEM, behavior: "smooth" });
    // Only a new value moves it; the options are the mount effect's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driven, value]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    // A click under the thumb for every value passing the middle, turned by
    // hand or by Casy; the jump back to the middle copy is the same value.
    const passing = ((Math.round(el.scrollTop / ITEM) % len) + len) % len;
    if (centred.current !== null && passing !== centred.current) haptic("select");
    centred.current = passing;
    if (driven) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const absIdx = Math.round(el.scrollTop / ITEM);
      const optIdx = ((absIdx % len) + len) % len;
      // CSS scroll-snap has already settled the wheel on an item, so the only
      // reason to touch scrollTop is drifting near either end of the repeats —
      // writing it every time just fought the browser's own snapping.
      if (absIdx < len || absIdx >= (COPIES - 1) * len) {
        el.scrollTop = (middleStart + optIdx) * ITEM;
      }
      if (options[optIdx].value !== value) onChange(options[optIdx].value);
    }, 90);
  }

  function handleClick(absIdx: number) {
    const el = containerRef.current;
    if (!el) return;
    if (absIdx === Math.round(el.scrollTop / ITEM)) {
      onPick?.();
      return;
    }
    // Item absIdx sits in the middle at scrollTop absIdx * ITEM (the padding
    // above the list is what centres it); handleScroll reports it on settle.
    el.scrollTo({ top: absIdx * ITEM, behavior: "smooth" });
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM;

  return (
    <div className="relative" style={{ height: VISIBLE * ITEM }}>
      {/* Centre selection band */}
      <div
        className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-lg bg-foreground/[0.06]"
        style={{ height: ITEM }}
      />
      {/* The items themselves fade out towards the top and bottom (a mask,
          not a band painted over them in one colour), so the wheel looks
          right on any background, a glass sheet included. */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_35%,black_65%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ paddingTop: pad, paddingBottom: pad }}>
          {list.map((o, i) => (
            <div
              key={i}
              onClick={() => handleClick(i)}
              className="flex cursor-pointer items-center justify-center text-sm text-foreground"
              style={{ height: ITEM, scrollSnapAlign: "center" }}
            >
              {o.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
