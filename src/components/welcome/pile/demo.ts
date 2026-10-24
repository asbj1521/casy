/** The welcome animation's shared values (#160, split out of WelcomePile.tsx). */

import { pileTimeline } from "@/lib/paperPile";
import { APP_TIME_ZONE } from "@/lib/zone";

/** Three made-up friends, in Apple Calendar's colours, each busy on a few days. */
export const FRIENDS = [
  { id: "sara", name: "Sara", color: "52, 199, 89", busy: [1, 4, 8, 11, 15, 18] },
  { id: "nova", name: "Nova", color: "175, 82, 222", busy: [3, 5, 10, 12, 17, 19] },
  { id: "erik", name: "Erik", color: "255, 149, 0", busy: [2, 6, 9, 13, 16, 20] },
];

export const TZ = APP_TIME_ZONE;

/**
 * The throws are Planlæg's own (pileTimeline: each calendar quicker than the
 * one before); everything after holds long enough to take in, since someone
 * new is meant to understand what they see.
 */
export const PILE = pileTimeline(FRIENDS.length);

/** One swipe: a confident throw off the screen, the stamp showing at once. */
export const SWIPE_TIME = 0.45;

/** The step caption: tall enough to fill the room under the list and its send button. */
export const CAPTION_HEIGHT = 124;

export const CAPTION_RADIUS = 28;
