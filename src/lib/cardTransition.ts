/**
 * A card that flies from one page into a card on the next: the landing
 * chart into the scheduler's day chart ("Go to Casy"), or into the sign-in
 * box ("Sign in"). The card moves and resizes into place, the rest of the old
 * page fades out, the new page fades in around it, and the new card's
 * contents appear once it has landed.
 *
 * Done with the browser's View Transitions API: document.startViewTransition
 * snapshots the page, lets us change it, and animates between the two,
 * pairing elements that share a view-transition-name. React Router's own
 * `viewTransition` option only works with its data router, not the
 * <BrowserRouter> this app uses, so it is started by hand here.
 *
 * Each page marks at most one card: `vt-card` on the card, and on a
 * destination `vt-card-content` around what is inside it, so its contents
 * can fade in on their own rather than being stretched with the card. The
 * names and the timing live in index.css, under the `card-flight` class this
 * puts on <html> for as long as the transition runs, so they never apply
 * otherwise. The destination calls cardArrived() once it is on the page.
 *
 * Where the browser has no view transitions, someone asked for reduced
 * motion, or the card is scrolled out of sight (nothing to fly from), it is
 * an ordinary navigation.
 */

import type { MouseEvent } from "react";

const FLIGHT_CLASS = "card-flight";

/**
 * Seconds until the card has landed (the card group's 550ms in index.css):
 * the scheduler chart's bars start rising then, not inside a card still on
 * its way.
 */
export const CARD_LANDS_S = 0.55;

/**
 * How long the browser may hold the old page on screen waiting for the new
 * card to render. It normally takes a frame or two; this only stops a card
 * that never mounts from freezing the page.
 */
const MAX_WAIT_MS = 500;

let arrived: (() => void) | null = null;
let running = false;

/**
 * Navigate with the card flying if it can, and say whether it will. False
 * means nothing happened and the caller navigates the ordinary way; true
 * means the caller must not (for a link: preventDefault).
 *
 * `prepare` loads what the new page needs before anything moves, such as a
 * lazy page's code: started first, the transition would capture the old page
 * a second time while the new one was still downloading.
 */
function goWithCard(navigate: () => void, prepare?: () => Promise<unknown>): boolean {
  if (typeof document.startViewTransition !== "function") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const from = document.querySelector(".vt-card")?.getBoundingClientRect();
  if (!from || from.bottom <= 0 || from.top >= window.innerHeight) return false;

  const fly = () => {
    const root = document.documentElement;
    root.classList.add(FLIGHT_CLASS);
    running = true;
    const transition = document.startViewTransition(
      () =>
        // The router renders the new page in a React transition, so it isn't
        // on screen when navigate() returns: the new page is captured once
        // its card has mounted (cardArrived) instead.
        new Promise<void>((resolve) => {
          arrived = resolve;
          navigate();
          window.setTimeout(resolve, MAX_WAIT_MS);
        }),
    );
    void transition.finished.finally(() => {
      root.classList.remove(FLIGHT_CLASS);
      running = false;
      arrived = null;
    });
  };

  if (prepare) {
    // Couldn't load it (offline): go anyway, the page shows its own error.
    prepare().then(fly, navigate);
  } else {
    fly();
  }
  return true;
}

/**
 * A link's onClick that flies the card there where it can (goWithCard). A
 * click meant for a new tab or window is the browser's business, not an
 * animation's, and is left to it.
 */
export function flyOnClick(
  e: MouseEvent,
  navigate: () => void,
  prepare?: () => Promise<unknown>,
): void {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (goWithCard(navigate, prepare)) e.preventDefault();
}

/** Called by a destination card once it is on the page. */
export function cardArrived(): void {
  arrived?.();
  arrived = null;
}

/** Whether a card mounting now is arriving through the transition. */
export function cardTransitionRunning(): boolean {
  return running;
}
