import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Contents that open and close by growing to their height and shrinking
 * away: a form, a list, a link. Already open on the first render, with no
 * animation. With `follow`, what scrolls around it scrolls along as it
 * grows, so contents opened at the bottom of a sheet come into view rather
 * than opening out of sight (#175).
 */
export default function Collapse({
  open,
  follow = false,
  className,
  children,
}: {
  open: boolean;
  follow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Followed only while it grows: closing, the page settles back by itself,
  // and following it there fought that frame by frame.
  const lastHeight = useRef(0);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          ref={box}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          // Every frame of the growth: its bottom kept in view.
          onUpdate={
            follow
              ? (latest) => {
                  const height = parseFloat(String(latest.height));
                  if (height > lastHeight.current) {
                    box.current?.scrollIntoView({ block: "nearest" });
                  }
                  lastHeight.current = height;
                }
              : undefined
          }
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
