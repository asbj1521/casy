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
 *
 * All of that is the fallback. While the page is subscribed to Realtime
 * (lib/livePush.ts) it is told when to ask, and asks on its own only every
 * few minutes, in case a message was lost.
 */

/** The steps: from `quietFor` ms after the last activity, ask every `every` ms. */
export const POLL_STEPS: readonly { quietFor: number; every: number }[] = [
  { quietFor: 0, every: 5_000 },
  { quietFor: 60_000, every: 15_000 },
  { quietFor: 3 * 60_000, every: 30_000 },
  { quietFor: 10 * 60_000, every: 60_000 },
];

/** While Realtime is telling the page about changes: only a rare check. */
export const PUSH_SAFETY_POLL_MS = 5 * 60_000;

/**
 * How long a hidden tab stays subscribed. Realtime counts open connections
 * against the plan, and a hidden tab doesn't need to hear anything: coming
 * back asks the pulse at once anyway.
 */
export const PUSH_HIDDEN_GRACE_MS = 60_000;

/**
 * Several changes in a row (say an answer, then the calendar entry it adds)
 * are asked about once.
 */
export const PUSH_SIGNAL_DEBOUNCE_MS = 300;

/**
 * How long to wait before the next ask, `quietMs` after the last activity,
 * and whether Realtime is telling the page about changes meanwhile.
 */
export function pollDelay(quietMs: number, pushLive = false): number {
  if (pushLive) return PUSH_SAFETY_POLL_MS;
  let every = POLL_STEPS[0].every;
  for (const step of POLL_STEPS) {
    if (quietMs >= step.quietFor) every = step.every;
  }
  return every;
}
