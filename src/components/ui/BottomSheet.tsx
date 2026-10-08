import { useEffect, useId, type ReactNode } from "react";

import { motion } from "framer-motion";

import Modal from "@/components/ui/Modal";

/**
 * The sheet slides up from below the screen, as iOS sheets do. Animated as
 * one `transform` string rather than Framer Motion's `y`, so the browser runs
 * it on the compositor (Web Animations): `y` is stepped from JavaScript every
 * frame, and on an iPhone busy drawing the page under it (My calendar's
 * months, #104) it moved in two or three visible jumps.
 */
const SHEET_MOTION = {
  initial: { transform: "translateY(100%)" },
  animate: { transform: "translateY(0%)" },
  exit: { transform: "translateY(100%)" },
  transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
} as const;

/**
 * A sheet rising from the bottom of a phone's screen, over everything, the
 * tab bar included: its title on the left, Done on the right, and what is
 * being chosen under them. The phone's scheduling flow (#101) opens its
 * pickers here rather than in a menu under their button, which near the
 * bottom of the screen would land behind the bar pinned there. Esc and a tap
 * outside close it too.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  doneLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel: string;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Modal open={open} placement="bottom" onClose={onClose}>
      <motion.div
        {...SHEET_MOTION}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-[17px] font-bold text-foreground">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[15px] font-semibold text-primary"
          >
            {doneLabel}
          </button>
        </div>
        {children}
      </motion.div>
    </Modal>
  );
}
