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
import { fetchFeedText, parseBusyIntervals } from "./ics.ts";
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

/**
 * A subscription's events, read from its feed like an ICS link (public https
 * only; the iCloud password is never sent there). Null if the feed can't be
 * fetched or read: that is the feed's problem, not the account's, so it must
 * not fail the other calendars.
 */
async function fetchSubscribedFeed(
  feedUrl: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<RawBusyInterval[] | null> {
  try {
    const text = addMissingTimezones(await fetchFeedText(feedUrl), windowStart, windowEnd);
    return parseBusyIntervals(text, windowStart, windowEnd).intervals;
  } catch (err) {
    console.error("iCloud subscription feed failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchAppleBusy(
  creds: CalDavCredentials,
  windowStart: Date,
  windowEnd: Date,
): Promise<{
  calendars: AppleCalendarBusy[];
  skippedEvents: number;
  uids: Set<string>;
  /** Ids of subscriptions whose feed couldn't be read this time; their intervals are empty. */
  failedFeeds: string[];
}> {
  let skippedEvents = 0;
  const uids = new Set<string>();
  const failedFeeds: string[] = [];
  const calendars = await discoverCalendars(creds);
  const fetched = await mapPool(calendars, CALENDAR_CONCURRENCY, async (cal) => {
    if (cal.feedUrl) {
      const intervals = await fetchSubscribedFeed(cal.feedUrl, windowStart, windowEnd);
      if (!intervals) failedFeeds.push(cal.id);
      return { id: cal.id, name: cal.name, writable: cal.writable, intervals: intervals ?? [] };
    }
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
  return { calendars: fetched, skippedEvents, uids, failedFeeds };
}
