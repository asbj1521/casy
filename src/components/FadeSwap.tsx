import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Cross-fades its children whenever `swapKey` changes: the old content fades
 * out, then the new fades in. Meant for the inside of a box, so the box itself
 * stays put while what it says changes. No fade on first render, or for
 * someone whose system asks for reduced motion.
 *
 * Skipping the first render's fade reaches further than it looks: framer
 * passes it down, so the children's own entrance animations are skipped too.
 * `playChildrenOnLoad` lets them run (and fades this box in with them).
 */
export default function FadeSwap({
  swapKey,
  className,
  playChildrenOnLoad = false,
  children,
}: {
  swapKey: string;
  playChildrenOnLoad?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={playChildrenOnLoad}>
      <motion.div
        key={swapKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeInOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
