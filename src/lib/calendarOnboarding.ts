/**
 * Whether this device has already been shown the "connect your calendar"
 * step after signing in with no calendars linked yet, so a person who skips
 * it (or just has none yet) isn't sent back to it on every visit.
 */
const key = (userId: string) => `casy-calendar-onboarding-seen:${userId}`;

export function hasSeenCalendarOnboarding(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function markCalendarOnboardingSeen(userId: string): void {
  try {
    localStorage.setItem(key(userId), "1");
  } catch {
    // Not remembered; the step may show again next time.
  }
}
