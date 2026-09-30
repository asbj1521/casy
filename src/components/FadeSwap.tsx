import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Cross-fades its children whenever `swapKey` changes: the old content fades
 * out, then the new fades in. Meant for the inside of a box, so the box itself
 * stays put while what it says changes. No fade on first render, or for
 * someone whose system asks for reduced motion.
 */
export default function FadeSwap({
  swapKey,
  className,
  children,
}: {
  swapKey: string;
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
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
