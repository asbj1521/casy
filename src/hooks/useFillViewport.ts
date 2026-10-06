import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The height that takes an element from where it starts on the page to the
 * bottom of the window, less `bottom` px, so a computer's view of it fits
 * on one screen without scrolling (#74's answering pane). Measured from the
 * top of the page, so scrolling doesn't change it; again on every resize.
 * Never less than `min`, so a very short window scrolls instead of
 * squeezing. Null until measured.
 */
export function useFillViewport(
  ref: RefObject<HTMLElement | null>,
  {
    bottom = 0,
    min = 0,
    active = true,
  }: {
    bottom?: number;
    min?: number;
    /** False while the element isn't on the page; measured again when it is. */
    active?: boolean;
  } = {},
): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(min, Math.floor(window.innerHeight - top - bottom)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, bottom, min, active]);
  return height;
}
