import { useEffect, useId, type FormEvent, type ReactNode } from "react";

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
 * home page's buttons included: its title on the left, one text action on the right, and
 * what is being chosen under them. Always glass, the page behind showing
 * through (#126, #153: the `glass` class in index.css), and barely dimmed.
 * The phone's scheduling flow (#101) opens its pickers here rather than in a
 * menu under their button, which near the bottom of the screen would land
 * behind the bar pinned there. Esc and a tap outside close it too.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  doneLabel,
  footer,
  onSubmit,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  doneLabel: string;
  /**
   * The sheet's way on, pinned along its bottom while the rest scrolls
   * (My calendar's Planlæg sheet, #126). Without one, the whole sheet scrolls.
   */
  footer?: ReactNode;
  /** The sheet as a form: Enter in a field, or a submit button in the footer, sends it. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** A request is running: a tap outside doesn't close it. */
  busy?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const header = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 id={titleId} className="min-w-0 break-words text-[17px] font-bold text-foreground">
        {title}
      </h3>
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="shrink-0 rounded-lg px-2 py-1 text-[15px] font-semibold text-primary disabled:opacity-50"
      >
        {doneLabel}
      </button>
    </div>
  );

  const aria = { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } as const;
  // A form only when asked: inside one, any button without a type would send it.
  const panel = (className: string, content: ReactNode) =>
    onSubmit ? (
      <motion.form {...SHEET_MOTION} {...aria} onSubmit={onSubmit} className={className}>
        {content}
      </motion.form>
    ) : (
      <motion.div {...SHEET_MOTION} {...aria} className={className}>
        {content}
      </motion.div>
    );

  return (
    <Modal open={open} placement="bottom" lightBackdrop busy={busy} onClose={onClose}>
      {footer
        ? panel(
            "glass relative z-10 flex max-h-[85dvh] w-full flex-col rounded-t-[28px]",
            <>
              <div className="px-4 pt-4">{header}</div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                {children}
              </div>
              <div className="px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                {footer}
              </div>
            </>,
          )
        : panel(
            "glass relative z-10 max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
            <>
              {header}
              {children}
            </>,
          )}
    </Modal>
  );
}
