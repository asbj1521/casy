/** How a dialog box in the middle of the screen appears, and its box (Modal, Sheet). */
export const PANEL_MOTION = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
};

// Scrolls inside when it's taller than the screen (a long list of people).
export const PANEL_CLASS =
  "relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl";
