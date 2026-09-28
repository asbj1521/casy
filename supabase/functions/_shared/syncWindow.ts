/**
 * The stretch of time every fetch of busy times covers: connecting a
 * calendar (all four ways) and every sync after it. One definition, so a
 * first import and the hourly refresh always agree.
 *
 * It starts a week back rather than now. A sync replaces everything that
 * hasn't ended by the window's start (replace_busy_blocks), so a window
 * starting "now" cut every event under way at that moment to begin then: a
 * lecture from 13:00 to 13:20, synced at 13:17, was stored as 13:17-13:20
 * for good. Starting a week back, events of the past week are fetched whole
 * again each time. Searches only ever look ahead, so this only ever changed
 * what My calendar showed for the past.
 */

/** How far ahead busy times are kept. */
export const SYNC_MONTHS_AHEAD = 12;
/** How far back each fetch reaches. */
export const SYNC_DAYS_BEHIND = 7;

const DAY_MS = 86_400_000;

export function syncWindow(now: Date = new Date()): { start: Date; end: Date } {
  return {
    // A span of time, not a local-calendar step, so plain milliseconds are right here.
    start: new Date(now.getTime() - SYNC_DAYS_BEHIND * DAY_MS),
    end: new Date(now.getTime() + SYNC_MONTHS_AHEAD * 30 * DAY_MS),
  };
}
