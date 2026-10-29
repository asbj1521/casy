import { haptic } from "@/lib/haptics";

/** How long the date takes to fly into its day. */
const FLIGHT_MS = 1000;
/** The ring spreading from the day as it lands. */
const RIPPLE_MS = 700;

/**
 * An agreed date flying into its day on the home page's month (#172): a chip
 * the size and colour of the month's own, with the event's title, starts
 * large over where the date came from (the date on AgreedCard) and arcs
 * down into its day, landing with a little overshoot, a ring spreading from
 * the day's number, a thud and a tick of success. Built on the
 * browser's animation engine, on transform and opacity only, like the
 * send flight (sendFlightPlay.ts); the chip is the size it lands at, so its
 * text is sharp where it ends. `onLand` runs as it lands (at once under
 * reduced motion, or if the day isn't on the page), so the month's own chip
 * takes over.
 */
export function flyIntoDay({
  from,
  day,
  label,
  colors,
  onLand,
}: {
  from: DOMRect;
  /** The day's local midnight, as the month marks its cells (data-day). */
  day: number;
  label: string;
  /** The month chip's own background and text colour ("rgb(...)"). */
  colors: { background: string; color: string };
  onLand: () => void;
}): void {
  const cell = document.querySelector<HTMLElement>(`[data-day="${day}"]`);
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!cell || still) {
    onLand();
    return;
  }
  // Where the month puts a day's first chip: under the day's number.
  const box = cell.getBoundingClientRect();
  const to = { left: box.left + 2, top: box.top + 40, width: box.width - 4, height: 17 };

  const chip = document.createElement("div");
  chip.textContent = label;
  Object.assign(chip.style, {
    position: "fixed",
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    padding: "0 4px",
    borderRadius: "4px",
    font: "600 11px/17px inherit",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    zIndex: "70",
    pointerEvents: "none",
    background: colors.background,
    color: colors.color,
    boxShadow: "0 10px 30px -8px rgba(0,0,0,0.35)",
  });
  document.body.appendChild(chip);

  // From the middle of where it came from, three times as big, over an arc.
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const lift = Math.min(160, Math.abs(dy) / 2.5);
  const animation = chip.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(3)`, opacity: 0 },
      { transform: `translate(${dx}px, ${dy}px) scale(3)`, opacity: 1, offset: 0.12 },
      {
        transform: `translate(${dx * 0.4}px, ${dy * 0.4 - lift}px) scale(1.8)`,
        offset: 0.55,
      },
      { transform: "translate(0, 0) scale(0.82)", offset: 0.86 },
      { transform: "translate(0, 0) scale(1.12)", offset: 0.94 },
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
    ],
    { duration: FLIGHT_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
  );
  animation.onfinish = () => {
    haptic("thud");
    window.setTimeout(() => haptic("success"), 120);
    ripple(box, colors.color);
    onLand();
    // A frame for the month's own chip to be drawn underneath first.
    requestAnimationFrame(() => chip.remove());
  };
}

/** A ring spreading from the day's number (the top of its cell) and fading. */
function ripple(cell: DOMRect, color: string) {
  const size = 32;
  const ring = document.createElement("div");
  Object.assign(ring.style, {
    position: "fixed",
    left: `${cell.left + cell.width / 2 - size / 2}px`,
    top: `${cell.top + 20 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "9999px",
    border: `3px solid ${color}`,
    zIndex: "70",
    pointerEvents: "none",
  });
  document.body.appendChild(ring);
  ring.animate(
    [
      { transform: "scale(1)", opacity: 0.9 },
      { transform: "scale(3.2)", opacity: 0 },
    ],
    { duration: RIPPLE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  ).onfinish = () => ring.remove();
}
