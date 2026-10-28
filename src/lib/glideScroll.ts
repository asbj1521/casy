/**
 * A fast scroll to a place (#168): about as quick as iOS's own scroll to the
 * top, quick at first and easing into place, so the person sees where it goes
 * without waiting for it. The browser's own smooth scroll takes its own time,
 * which over a year of months is slow.
 *
 * A touch or the wheel stops it, so it never fights a finger. With reduced
 * motion asked for, it jumps. A flick still coasting on a touch screen is
 * stopped first: left to coast, iOS kept scrolling under the glide (the
 * screen flashed blank) and carried on from where the glide ended.
 */

/** How long a glide takes, however far it goes. */
const GLIDE_MS = 350;

/** The glide running on each scroller, so a new one replaces it. */
const running = new WeakMap<HTMLElement, () => void>();

/** Glide `box` (a scrolling element, or the page's) to `top`. */
export function glideScroll(box: HTMLElement, top: number): void {
  running.get(box)?.();
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;

  // The page's own scroller takes no listeners; its window does.
  const target: EventTarget = box === document.scrollingElement ? window : box;
  const overflow = box.style.overflowY;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    box.style.overflowY = overflow;
    target.removeEventListener("touchstart", stop);
    target.removeEventListener("wheel", stop);
    running.delete(box);
  };
  target.addEventListener("touchstart", stop, { passive: true });
  target.addEventListener("wheel", stop, { passive: true });
  running.set(box, stop);

  const glide = () => {
    box.style.overflowY = overflow;
    const from = box.scrollTop;
    const to = Math.max(0, Math.min(top, box.scrollHeight - box.clientHeight));
    if (still || from === to) {
      box.scrollTop = to;
      stop();
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / GLIDE_MS);
      // Ease out (cubic): most of the way at once, then into place.
      box.scrollTop = from + (to - from) * (1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(step);
      else stop();
    };
    frame = requestAnimationFrame(step);
  };

  if (touch) {
    // Hidden for a frame, the scroller stops coasting where it is.
    box.style.overflowY = "hidden";
    frame = requestAnimationFrame(glide);
  } else glide();
}
