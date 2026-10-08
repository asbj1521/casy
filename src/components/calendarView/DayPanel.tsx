import { forwardRef, useEffect, type ReactNode } from "react";

/** iOS's own sheet curve and length. */
const SLIDE = "320ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * A tapped day's busy time on My calendar (#104), as a panel along the
 * bottom of the screen, above the tab bar, with the month still live behind
 * it: no backdrop, so another day can be tapped straight away. It is always
 * on the page and only slides, its own layer from the start (will-change),
 * so opening it draws nothing new mid-animation; that, and no full-screen
 * dimming over a year of calendar, is what keeps it smooth on an iPhone.
 * Hidden once it has slid away (visibility after the slide), so it is out
 * of reach of taps and screen readers while closed.
 */
const DayPanel = forwardRef<
  HTMLElement,
  {
    open: boolean;
    title: string;
    doneLabel: string;
    onClose: () => void;
    children: ReactNode;
  }
>(function DayPanel({ open, title, doneLabel, onClose, children }, ref) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <section
      ref={ref}
      aria-label={title}
      aria-hidden={!open}
      inert={!open}
      className="fixed inset-x-0 bottom-[var(--tab-bar-height)] z-30 max-h-[45dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-card px-4 pb-3 pt-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)] will-change-transform"
      style={{
        transform: open ? "translateY(0)" : "translateY(calc(100% + var(--tab-bar-height)))",
        visibility: open ? "visible" : "hidden",
        transition: open
          ? `transform ${SLIDE}, visibility 0s`
          : `transform ${SLIDE}, visibility 0s linear 320ms`,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[17px] font-bold text-foreground">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-[15px] font-semibold text-primary"
        >
          {doneLabel}
        </button>
      </div>
      {children}
    </section>
  );
});

export default DayPanel;
