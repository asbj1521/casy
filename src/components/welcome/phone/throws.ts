/** The timing of the paper calendars thrown on the phone (#228). */

/**
 * How the paper calendars come, in seconds: the first takes its time, each
 * after it is a little quicker and leaves as the one before is slowing down, so
 * they end up shuffling onto each other without ever looking rushed.
 */
const FLY = [1.05, 0.86, 0.7, 0.56, 0.44];
const LEAVE_AFTER = [0.95, 0.74, 0.58, 0.46];
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
