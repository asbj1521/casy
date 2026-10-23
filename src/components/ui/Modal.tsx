import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { PANEL_CLASS, PANEL_MOTION } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

/**
 * A dialog's backdrop and centring. Children render only while open, so a
 * form inside starts fresh every time. Clicking the backdrop closes it,
 * except while `busy`, so a request in flight can't be abandoned halfway.
 *
 * Drawn at the end of <body> (a portal), not where it is written: inside a
 * sheet that slid up with a transform (BottomSheet), `fixed` would otherwise
 * be measured from that sheet rather than the screen, so a picker opened
 * from a sheet (#126) would land inside it.
 */
export default function Modal({
  open,
  busy = false,
  onClose,
  placement = "center",
  lightBackdrop = false,
  children,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  /** "bottom": a sheet rising from the bottom edge, as phone apps have. */
  placement?: "center" | "bottom";
  /** Barely dimmed, for a glass sheet whose point is the page showing through (#126). */
  lightBackdrop?: boolean;
  children: ReactNode;
}) {
  return createPortal(
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
            className={cn("absolute inset-0", lightBackdrop ? "bg-black/10" : "bg-black/40")}
            onClick={busy ? undefined : onClose}
          />
          {children}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

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
