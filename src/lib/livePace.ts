/**
 * How often an open page asks the pulse whether anything changed for you
 * (useLiveUpdates). Every ask is an Edge Function call, so a tab nobody is
 * using shouldn't ask as often as one where something is going on.
 *
 * "Activity" is anything that makes a change by someone else likely soon:
 * the pulse just moved, you did something (any mutation), or you came back to
 * the tab. Right after it the page asks every 5 seconds, then slows down the
 * longer it stays quiet. Hidden tabs don't ask at all (React Query pauses
 * `refetchInterval` in the background).
 */

/** The steps: from `quietFor` ms after the last activity, ask every `every` ms. */
export const POLL_STEPS: readonly { quietFor: number; every: number }[] = [
  { quietFor: 0, every: 5_000 },
  { quietFor: 60_000, every: 15_000 },
  { quietFor: 3 * 60_000, every: 30_000 },
  { quietFor: 10 * 60_000, every: 60_000 },
];

/** How long to wait before the next ask, `quietMs` after the last activity. */
export function pollDelay(quietMs: number): number {
  let every = POLL_STEPS[0].every;
  for (const step of POLL_STEPS) {
    if (quietMs >= step.quietFor) every = step.every;
  }
  return every;
}
