/**
 * The moment Planlæg's dates are sent for voting (#102), on a phone. Once the
 * server has confirmed the send, the dates that didn't make the top N swipe
 * off to the right, one after another from the bottom row up, and then the
 * top N fly down into the home page's Aftaler button (#169), the bottom one
 * first, the button hopping with a haptic as each arrives. Then the plan
 * closes onto the home page, the vote waiting under Aftaler.
 *
 * The list sits in a scrolling box that would clip anything leaving it, so
 * each row is copied onto a layer of its own above the page and the copies
 * are moved with the browser's animation engine (transform and opacity only,
 * which run off the main thread: smooth on an iPhone). The copies are exact,
 * since they are clones of the rows. This file is the timing, free of the DOM
 * so it can be tested; sendFlightPlay.ts carries it out.
 */
/** All times in seconds, the way PILE_TIMING's are. */
export const FLIGHT_TIMING = {
  /** A row swiping off to the right. */
  away: 0.38,
  /** Between one swiped-off row and the next, bottom to top... */
  awayStagger: 0.08,
  /** ...but all of them together never take longer than this to start. */
  awaySpan: 0.7,
  /** How much of the last swipe is still going when the first date lifts off. */
  overlap: 0.15,
  /** A date flying down into the Aftaler button. */
  fly: 0.62,
  /** Between one date leaving and the next. */
  flyStagger: 0.12,
  /** The last date has arrived: a beat before the plan closes. */
  after: 0.25,
} as const;

interface FlightStep {
  /** "away": swiped off to the right; "fly": down into the Aftaler button. */
  move: "away" | "fly";
  delay: number;
  duration: number;
}

interface FlightPlan {
  /** For each row, in the order they are drawn, top to bottom. */
  steps: FlightStep[];
  /** When the last date has arrived, and the plan may close. */
  end: number;
}

/**
 * When each row moves. `offered[i]` says whether row i (top to bottom) is one
 * of the dates sent. The rows not sent go first, from the bottom up; the sent
 * ones follow, again from the bottom up, the nearest to the button first.
 */
export function flightPlan(offered: boolean[]): FlightPlan {
  const T = FLIGHT_TIMING;
  const steps: FlightStep[] = offered.map(() => ({ move: "fly", delay: 0, duration: T.fly }));

  const away = offered.flatMap((sent, i) => (sent ? [] : [i])).reverse();
  const stagger =
    away.length > 1 ? Math.min(T.awayStagger, T.awaySpan / (away.length - 1)) : T.awayStagger;
  away.forEach((row, n) => {
    steps[row] = { move: "away", delay: n * stagger, duration: T.away };
  });
  const awayEnd = away.length > 0 ? (away.length - 1) * stagger + T.away - T.overlap : 0;

  const fly = offered.flatMap((sent, i) => (sent ? [i] : [])).reverse();
  fly.forEach((row, n) => {
    steps[row] = { move: "fly", delay: awayEnd + n * T.flyStagger, duration: T.fly };
  });
  const end = fly.length > 0 ? awayEnd + (fly.length - 1) * T.flyStagger + T.fly : awayEnd;
  return { steps, end };
}
