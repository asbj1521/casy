import type { StartWindow } from "@/lib/eventSearch";
import type { SchedulerSettings } from "@/lib/scheduler";

/**
 * How far a meeting's start may move from the hour picked (#173): exact, or
 * up to two hours either way, in half hours (the row's minus and plus). The whole meeting
 * moves; its length stays. Stored as the start window (#133) around the
 * hour, clamped to the day, which the search reads as "closest to the hour".
 */
export const FLEX_MINUTES = [0, 30, 60, 90, 120] as const;

/** The last start a window may hold (the server's limit: 23:30). */
const LAST_START = 24 * 60 - 30;

/** The start window for `startHour` give or take `flex` minutes; none for exact. */
export function flexWindow(startHour: number, flex: number): StartWindow | null {
  if (flex <= 0) return null;
  const at = startHour * 60;
  return { from: Math.max(0, at - flex), to: Math.min(LAST_START, at + flex) };
}

/**
 * The flexibility the settings hold: 0 for a fixed start, one of
 * FLEX_MINUTES for a window set around the hour, null for any other window
 * (one Casy's AI or a widen suggestion set, read as "Mellem 18:00 og 21:00").
 */
export function flexOf(settings: SchedulerSettings): number | null {
  const w = settings.startWindow;
  if (!w) return 0;
  const flex = FLEX_MINUTES.find((f) => {
    const own = flexWindow(settings.startHour, f);
    return own !== null && own.from === w.from && own.to === w.to;
  });
  return flex ?? null;
}
