/** The timing of the paper calendars thrown on the phone (#228). */

/**
 * How the paper calendars come, in seconds: the first at an easy pace, the rest
 * clearly quicker, each leaving as the one before is slowing down, so they end
 * up shuffling onto each other without keeping you waiting.
 */
const FLY = [0.82, 0.54, 0.42, 0.36, 0.32];
const LEAVE_AFTER = [0.72, 0.42, 0.32, 0.26];
/** The landing: past the spot a little, back, and settled. */
export const HIT = 0.48;

export const THROWS = (() => {
  let at = 0;
  return FLY.map((fly, k) => {
    const start = at;
    at += LEAVE_AFTER[k] ?? 0;
    return { at: start, fly, landed: start + fly };
  });
})();
/** The last calendar settled, from the first throw. */
export const STACK_DONE = THROWS[THROWS.length - 1].landed + HIT;
