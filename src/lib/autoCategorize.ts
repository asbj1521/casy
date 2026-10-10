/**
 * Sorting calendars with AI in the background (#118): which calendars still
 * need a category, and, on the admin's own phone while this is tested, a few
 * event titles per calendar to sort them by. Pure; useAutoCategorize calls
 * the server (calendar-categorize), which checks everything again.
 */
import type { CalendarConnectionStatus } from "@/api/calendars";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

/** Titles sent per calendar (the server keeps at most as many). */
export const SAMPLE_TITLES = 15;

/**
 * The calendars nobody has categorised: no category, and no record of
 * anyone setting one (a category cleared by hand, or one Casy couldn't
 * guess, is never asked about again).
 */
export function uncategorised(connections: CalendarConnectionStatus[]): string[] {
  return connections
    .filter((c) => c.status === "connected")
    .flatMap((c) => c.calendar_sources)
    .filter((s) => s.purpose === null && s.purpose_source === null)
    .map((s) => s.id);
}

/** The server's id for each of this phone's calendars, by EventKit id. */
export function phoneSourceIds(
  connections: CalendarConnectionStatus[],
  connectionId: string,
): Map<string, string> {
  const ids = new Map<string, string>();
  for (const c of connections) {
    if (c.id !== connectionId) continue;
    for (const s of c.calendar_sources) if (s.external_id) ids.set(s.external_id, s.id);
  }
  return ids;
}

/**
 * Up to SAMPLE_TITLES distinct titles for each of `wanted`'s calendars,
 * those nearest `now` first (what the calendar is used for these days),
 * cancelled events left out.
 */
export function sampleTitles(
  events: PhoneEventWithDetails[],
  serverIdOf: Map<string, string>,
  wanted: Set<string>,
  now: number,
): Record<string, string[]> {
  const when = (e: PhoneEventWithDetails) =>
    e.start ?? (e.startDay ? Date.parse(`${e.startDay}T12:00:00Z`) : now);
  const nearest = [...events].sort((a, b) => Math.abs(when(a) - now) - Math.abs(when(b) - now));
  const titles: Record<string, string[]> = {};
  for (const event of nearest) {
    const id = serverIdOf.get(event.calendarId);
    const title = event.title?.trim();
    if (!id || !wanted.has(id) || !title || event.cancelled) continue;
    const list = (titles[id] ??= []);
    if (list.length < SAMPLE_TITLES && !list.includes(title)) list.push(title);
  }
  return titles;
}
