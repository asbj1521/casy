/**
 * Which calendars can be the primary calendar, as the profile page offers
 * them. Kept out of the component so it can be tested.
 */
import type { CalendarConnectionStatus } from "@/api/calendarStatus";
import { calendarSourceName } from "@/lib/accountSummary";

export interface PrimaryOption {
  id: string;
  name: string;
}

export interface PrimaryOptionGroup {
  /** The account the calendars belong to (an email), for the list's headings. */
  account: string;
  calendars: PrimaryOption[];
}

/**
 * Every calendar Casy may write to, grouped by account, in the order the
 * accounts are listed. The current primary calendar is always included, even
 * if it has since become read-only, so the list can still show what is chosen.
 */
export function primaryOptions(
  connections: CalendarConnectionStatus[],
  primaryId: string | null,
): PrimaryOptionGroup[] {
  return connections
    .filter((c) => c.status === "connected")
    .map((c) => ({
      account: c.account_label ?? c.provider,
      calendars: c.calendar_sources
        .filter((s) => s.writable || s.id === primaryId)
        .map((s) => ({ id: s.id, name: calendarSourceName(s) })),
    }))
    .filter((g) => g.calendars.length > 0);
}

/** The primary calendar's name, or null if it isn't among the connections. */
export function primaryName(
  connections: CalendarConnectionStatus[],
  primaryId: string | null,
): string | null {
  if (!primaryId) return null;
  for (const c of connections) {
    const source = c.calendar_sources.find((s) => s.id === primaryId);
    if (source) return calendarSourceName(source);
  }
  return null;
}
