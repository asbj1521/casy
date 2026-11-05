import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";

import { haptic } from "@/lib/haptics";

/** How far past half its width, or how fast, a swipe must go to stay open. */
const FLICK_PX_PER_S = 400;
const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * A list row that slides left to show one red button, as iOS Mail's rows do
 * (#223). The button only shows; a press does it, so a stray swipe costs
 * nothing. While it is open or moving, a tap on the row closes it instead of
 * opening what the row leads to. A swipe can't be done with VoiceOver, so
 * whatever this offers must also be reachable another way.
 */
export default function SwipeReveal({
  label,
  open,
  onOpenChange,
  onPress,
  children,
}: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPress: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const button = useRef<HTMLButtonElement>(null);
  const [moving, setMoving] = useState(false);
  // The button's width, in rem so it follows the text size: measured.
  const [width, setWidth] = useState(88);
  useLayoutEffect(() => {
    if (button.current) setWidth(button.current.offsetWidth);
  }, []);

  const settle = (stayOpen: boolean) => {
    onOpenChange(stayOpen);
    const to = stayOpen ? -width : 0;
    if (reduce) x.set(to);
    else void animate(x, to, SPRING);
  };
  // Closed from outside (another row opened): back it goes. Read as it renders,
  // since the parent holds which row is open.
  const [shown, setShown] = useState(open);
  if (open !== shown) {
    setShown(open);
    if (!open) {
      if (reduce) x.set(0);
      else void animate(x, 0, SPRING);
    }
  }

  return (
    // A row is often a link: the browser's own "drag this link" would end the swipe.
    <div className="relative overflow-hidden" onDragStartCapture={(e) => e.preventDefault()}>
      <button
        ref={button}
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={onPress}
        className="absolute inset-y-0 right-0 w-[5.5rem] bg-red-600 text-[0.9375rem] font-semibold text-white"
      >
        {label}
      </button>
      <motion.div
        // Solid, or the red would show through the glass of the row on top.
        className="relative touch-pan-y select-none bg-card [-webkit-touch-callout:none]"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragListener
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={{ left: -width, right: 0 }}
        onDragStart={() => setMoving(true)}
        onDragEnd={(_, info: PanInfo) => {
          const stayOpen =
            info.velocity.x < -FLICK_PX_PER_S ||
            (info.velocity.x < FLICK_PX_PER_S && x.get() < -width / 2);
          if (stayOpen && !open) haptic("select");
          settle(stayOpen);
          // The click the lifted finger makes lands on the cover below, not the row.
          window.setTimeout(() => setMoving(false), 300);
        }}
      >
        {children}
        {(open || moving) && (
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => settle(false)}
            className="absolute inset-0"
          />
        )}
      </motion.div>
    </div>
  );
}
