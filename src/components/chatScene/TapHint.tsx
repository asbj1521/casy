import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

/**
 * Where to tap, plainly (#275): a pulsing orange ring around `children` and an
 * arrow bouncing above it, while `on`. The welcome's three taps each get one,
 * so nobody has to guess what to press.
 */
export default function TapHint({
  on,
  round = false,
  children,
}: {
  on: boolean;
  /** A round target (the send button) rather than a rounded box. */
  round?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex">
      {children}
      {on && (
        <>
          <motion.span
            aria-hidden
            className={`pointer-events-none absolute -inset-[6px] border-[3px] border-[#FF4D00] ${round ? "rounded-full" : "rounded-[22px]"}`}
            animate={{ scale: [1, 1.12, 1], opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -top-[52px] left-1/2 -ml-[18px] text-[#FF4D00]"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown className="h-9 w-9" strokeWidth={3} />
          </motion.span>
        </>
      )}
    </span>
  );
}
