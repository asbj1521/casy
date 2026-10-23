import { useEffect, useId, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";

import BottomSheet from "@/components/ui/BottomSheet";
import Modal from "@/components/ui/Modal";
import { PANEL_CLASS, PANEL_MOTION } from "@/components/ui/panel";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";

/**
 * Something opened over a page, the same on every device (CLAUDE.md, Design
 * language): a glass sheet from the bottom on a phone, a dialog in the middle
 * on a computer. Both have the title on the left, one text action on the
 * right (`closeLabel`: Annuller, Færdig), and the main button (`footer`) at
 * the bottom. With `onSubmit` it is a form, so Enter sends it.
 */
export default function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  footer,
  onSubmit,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  footer?: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** A request is running: neither a tap outside nor Esc closes it. */
  busy?: boolean;
  children: ReactNode;
}) {
  const phone = usePhoneLayout();
  if (phone) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        doneLabel={closeLabel}
        footer={footer}
        onSubmit={onSubmit}
        busy={busy}
      >
        {children}
      </BottomSheet>
    );
  }
  return (
    <Modal open={open} busy={busy} onClose={onClose}>
      <DialogPanel
        title={title}
        closeLabel={closeLabel}
        footer={footer}
        onSubmit={onSubmit}
        busy={busy}
        onClose={onClose}
      >
        {children}
      </DialogPanel>
    </Modal>
  );
}

/** A computer's version: only mounted while open, so Esc is listened to only then. */
function DialogPanel({
  title,
  closeLabel,
  footer,
  onSubmit,
  busy,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  footer?: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    if (busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const className = `${PANEL_CLASS} max-w-md`;
  const content = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={titleId} className="min-w-0 break-words text-lg font-bold text-foreground">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="shrink-0 rounded-lg px-2 py-1 text-[15px] font-semibold text-primary transition hover:bg-secondary disabled:opacity-50"
        >
          {closeLabel}
        </button>
      </div>
      {children}
      {footer && <div className="mt-5">{footer}</div>}
    </>
  );
  // A form only when asked: inside one, any button without a type would send it.
  return onSubmit ? (
    <motion.form
      {...PANEL_MOTION}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onSubmit={onSubmit}
      className={className}
    >
      {content}
    </motion.form>
  ) : (
    <motion.div
      {...PANEL_MOTION}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={className}
    >
      {content}
    </motion.div>
  );
}
