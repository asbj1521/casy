/** The timing of the paper calendars thrown on the phone (#228). */

/**
 * How the paper calendars come, in seconds: the first takes its time, then each
 * is much quicker than the one before and leaves before the last has settled,
 * ending like cards being shuffled.
 */
const FLY = [0.62, 0.4, 0.26, 0.17, 0.12];
const LEAVE_AFTER = [0.72, 0.44, 0.26, 0.15];
export const HIT = 0.24;

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
