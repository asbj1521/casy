/**
 * The day chart's rise (DayChart.tsx, and its copy on the landing page): the
 * bars grow in left to right. Shared so the two charts keep the same pace.
 */

export interface RiseSpeed {
  /** Seconds between one bar starting and the next. */
  stagger: number;
  /** Seconds one bar takes to rise. */
  duration: number;
}

/** When a chart first appears, or its data first arrives. */
export const RISE_FULL: RiseSpeed = { stagger: 0.04, duration: 0.5 };

/** When the i-th bar starts rising, in seconds: left to right, `base` in. */
export function barRiseDelay(i: number, speed: RiseSpeed = RISE_FULL, base = 0.1): number {
  return base + i * speed.stagger;
}

/** What the chart shows: which group, which month, and whether it is still loading. */
export interface ChartView {
  swapKey: string;
  month: string;
  loading: boolean;
}

/**
 * What the chart does as it changes: `rise` (the bars grow in, left to
 * right), `slide` (the month slides over like a carousel, `back` when the new
 * month is earlier), or null (nothing moves).
 */
export type ChartMotion = { kind: "rise" } | { kind: "slide"; back: boolean } | null;

/**
 * The motion for a change of view: a rise when the data has just arrived, a
 * slide when the month changed, nothing after a group switch (the fade covers
 * it), and otherwise whatever was set before. `month` is the month's first
 * day as an ISO date, so an earlier month is a smaller string.
 */
export function nextChartMotion(
  before: ChartView,
  after: ChartView,
  current: ChartMotion,
): ChartMotion {
  if (before.loading && !after.loading) return { kind: "rise" };
  if (after.swapKey !== before.swapKey) return null;
  if (after.month !== before.month) return { kind: "slide", back: after.month < before.month };
  return current;
}
