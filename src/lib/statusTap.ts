/**
 * A tap at the very top of the screen in the iPhone app (by the Dynamic
 * Island, #168): iOS scrolls back to the top. It only does so for one native
 * scroll view, and Casy's screens scroll inside the page, so the app catches
 * the tap itself (StatusTapCatcher in MainViewController.swift) and sends
 * this event. A screen that scrolls a box of its own (My calendar's months)
 * takes the tap (useStatusTap); every other screen glides the page up.
 */
import { glideScroll } from "@/lib/glideScroll";

const STATUS_TAP = "casy:status-tap";

/** The screens that take the tap themselves, the newest last. */
const takers: (() => void)[] = [];

/** Listen for the tap; called once, in the app only (fitToApp). */
export function listenForStatusTap() {
  window.addEventListener(STATUS_TAP, () => {
    const take = takers[takers.length - 1];
    if (take) take();
    else if (document.scrollingElement instanceof HTMLElement) {
      glideScroll(document.scrollingElement, 0);
    }
  });
}

/** Take the tap instead of the page; answers how to stop taking it. */
export function takeStatusTap(take: () => void): () => void {
  takers.push(take);
  return () => {
    const i = takers.indexOf(take);
    if (i >= 0) takers.splice(i, 1);
  };
}
