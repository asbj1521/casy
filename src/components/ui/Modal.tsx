import type { FormEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * A dialog's backdrop and centring. Children render only while open, so a
 * form inside starts fresh every time. Clicking the backdrop closes it,
 * except while `busy`, so a request in flight can't be abandoned halfway.
 */
export default function Modal({
  open,
  busy = false,
  onClose,
  placement = "center",
  children,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  /** "bottom": a sheet rising from the bottom edge, as phone apps have. */
  placement?: "center" | "bottom";
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex justify-center",
            placement === "bottom" ? "items-end" : "items-center p-4",
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={busy ? undefined : onClose}
          />
          {children}
        </div>
      )}
    </AnimatePresence>
  );
}

const PANEL_MOTION = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
};

// Scrolls inside when it's taller than the screen (a long list of people).
const PANEL_CLASS =
  "relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl";

/** The dialog box, as a form: Enter in a field submits it. */
export function ModalForm({
  className,
  onSubmit,
  children,
}: {
  className?: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <motion.form {...PANEL_MOTION} onSubmit={onSubmit} className={cn(PANEL_CLASS, className)}>
      {children}
    </motion.form>
  );
}

/**
 * The dialog box, when there's nothing to submit. `labelledBy` is the id of
 * its heading, which screen readers announce as the dialog's name.
 */
export function ModalPanel({
  className,
  labelledBy,
  children,
}: {
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      {...PANEL_MOTION}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={cn(PANEL_CLASS, className)}
    >
      {children}
    </motion.div>
  );
}
