/**
 * Whether this device has already been shown the "connect your calendar"
 * step after signing in with no calendars linked yet, so a person who skips
 * it (or just has none yet) isn't sent back to it on every visit.
 */
import { readStored, writeStored } from "@/lib/storage";

const key = (userId: string) => `casy-calendar-onboarding-seen:${userId}`;

export function hasSeenCalendarOnboarding(userId: string): boolean {
  return readStored(key(userId)) === "1";
}

export function markCalendarOnboardingSeen(userId: string): void {
  writeStored(key(userId), "1");
}
