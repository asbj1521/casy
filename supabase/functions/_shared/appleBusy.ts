/**
 * Every event calendar in an iCloud account, reduced to busy intervals.
 *
 * Shared by calendar-add-apple (the first fetch, when the account is
 * connected) and the scheduled sync, so both read an account the same way.
 * Throws CalDavError (CalDavLoginError for a refused password) for anything
 * wrong with the account or iCloud.
 *
 * It also reports the UID of every event it saw, across all the account's
 * calendars: that is how the sync notices an entry Casy added being deleted
 * by hand (calendarWrites.ts). The UIDs are only compared, never stored.
 */
import { discoverCalendars, fetchEventDocuments, mapPool, type CalDavCredentials } from "./caldav.ts";
import { parseBusyIntervals } from "./ics.ts";
import { mergeIntervals, type RawBusyInterval } from "./intervals.ts";
import { addMissingTimezones } from "./timezones.ts";

// Calendars fetched at once: fast enough, gentle enough not to trip rate limits.
const CALENDAR_CONCURRENCY = 4;

export interface AppleCalendarBusy {
  /** The calendar's CalDAV id: calendar_sources.external_calendar_id. */
  id: string;
  name: string | null;
  /** Casy may add events to it (see CalDavCalendar). */
  writable: boolean;
  intervals: RawBusyInterval[];
}

/**
 * The UIDs in one event document. Read from the raw text before any parsing,
 * so an event Casy can't otherwise read still counts as there. Folded lines
 * (RFC 5545 3.1) are joined first.
 */
export function eventUids(doc: string): string[] {
  const unfolded = doc.replace(/\r?\n[ \t]/g, "");
  return [...unfolded.matchAll(/^UID(?:;[^:\r\n]*)?:(.*)$/gm)].map((m) => m[1].trim()).filter(Boolean);
}

export async function fetchAppleBusy(
  creds: CalDavCredentials,
  windowStart: Date,
  windowEnd: Date,
): Promise<{ calendars: AppleCalendarBusy[]; skippedEvents: number; uids: Set<string> }> {
  let skippedEvents = 0;
  const uids = new Set<string>();
  const calendars = await discoverCalendars(creds);
  const fetched = await mapPool(calendars, CALENDAR_CONCURRENCY, async (cal) => {
    const documents = await fetchEventDocuments(creds, cal.url, windowStart, windowEnd);
    const intervals: RawBusyInterval[] = [];
    for (const doc of documents) {
      for (const uid of eventUids(doc)) uids.add(uid);
      try {
        // iCloud names time zones without defining them; fill those in first.
        const complete = addMissingTimezones(doc, windowStart, windowEnd);
        intervals.push(...parseBusyIntervals(complete, windowStart, windowEnd).intervals);
      } catch {
        // One unreadable event (an odd time zone, say) must not sink the
        // whole account. It is counted so the user is told, not hidden.
        skippedEvents++;
      }
    }
    return { id: cal.id, name: cal.name, writable: cal.writable, intervals: mergeIntervals(intervals) };
  });
  return { calendars: fetched, skippedEvents, uids };
}
