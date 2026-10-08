import { useEffect, useId, type ReactNode } from "react";

import Modal, { ModalPanel } from "@/components/ui/Modal";

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
      <ModalPanel
        labelledBy={titleId}
        className="max-h-[85dvh] rounded-b-none border-x-0 border-b-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
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
      </ModalPanel>
    </Modal>
  );
}
