/**
 * The iPhone app showing your own events as they are (#110): title, place
 * and notes, read from the phone's calendars by the plugin's `readDetails`
 * and drawn on this phone only. Nothing here is ever sent: the push to the
 * server is built from `read` (phoneBusy.ts), which has no details at all.
 *
 * Casy's server stores a phone calendar as merged busy blocks. For the
 * calendars of this phone, the app draws the phone's own events in their
 * place, one block per event with its details, under the same rules for what
 * counts (busySpan), so the busy time drawn is the same.
 *
 * Pure: the plugin's answer and the calendar list go in, blocks come out.
 */
import type { EventDetails, OverviewBlock, OverviewCalendar } from "@/lib/calendarOverview";
import { busySpan, type PhoneEvent } from "@/lib/phoneBusy";

/** One event as `readDetails` returns it: its timing, and what it is. */
export interface PhoneEventWithDetails extends PhoneEvent, Partial<EventDetails> {}

/**
 * The server's calendar id for each EventKit calendar of this phone's
 * connection: only those can be drawn from the phone.
 */
export function phoneCalendarIds(
  calendars: OverviewCalendar[],
  connectionId: string,
): Map<string, string> {
  const ids = new Map<string, string>();
  for (const c of calendars) {
    if (c.connectionId === connectionId && c.externalId) ids.set(c.externalId, c.id);
  }
  return ids;
}

/**
 * Your blocks with this phone's calendars drawn from the phone: every block
 * of those calendars is replaced by the phone's events in the same span (one
 * block each, with its details), every other calendar's blocks are kept.
 * Events the server wouldn't count (cancelled, declined, timed and free)
 * aren't drawn, as they aren't busy time.
 */
export function withPhoneEvents(
  blocks: OverviewBlock[],
  events: PhoneEventWithDetails[],
  serverIdOf: Map<string, string>,
  window: { from: number; to: number },
): OverviewBlock[] {
  if (serverIdOf.size === 0) return blocks;
  const replaced = new Set(serverIdOf.values());
  const fromPhone: OverviewBlock[] = [];
  for (const event of events) {
    const calendarId = serverIdOf.get(event.calendarId);
    const span = calendarId ? busySpan(event) : null;
    if (!calendarId || !span || span.end <= window.from || span.start >= window.to) continue;
    fromPhone.push({
      calendarId,
      start: new Date(span.start).toISOString(),
      end: new Date(span.end).toISOString(),
      details: {
        title: event.title?.trim() ?? "",
        location: event.location?.trim() ?? "",
        notes: event.notes?.trim() ?? "",
      },
    });
  }
  return [...blocks.filter((b) => !replaced.has(b.calendarId)), ...fromPhone];
}
