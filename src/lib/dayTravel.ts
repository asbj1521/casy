/**
 * The day view's glide from one vote's date to the next (#176): the days
 * rush sideways and stop softly on the date, blurred along the way as a
 * camera blurs what passes it fast. Pure, so its pace is tested and tuned
 * here rather than in the component.
 */

/** Off quickly, then a long soft stop on the date. */
export const TRAVEL_EASE = [0.6, 0, 0.1, 1] as const;

/** The most the days are blurred sideways, in pixels. */
const MAX_BLUR_PX = 8;
/** Slower than this (pixels a second) the days are sharp. */
const SHARP_BELOW = 600;
/** How much faster (pixels a second) for each pixel more of blur. */
const PER_BLUR_PX = 400;

/** How long the glide takes over `days` days: about 350 ms, a little more the further, at most 0.9 s. */
export function travelMs(days: number): number {
  const d = Math.abs(days);
  return d === 0 ? 0 : Math.min(350 + 40 * d, 900);
}

/** The sideways blur for the speed the days move at (pixels a second, either way). */
export function travelBlur(pxPerSecond: number): number {
  const v = Math.abs(pxPerSecond);
  return v <= SHARP_BELOW ? 0 : Math.min(MAX_BLUR_PX, (v - SHARP_BELOW) / PER_BLUR_PX);
}
