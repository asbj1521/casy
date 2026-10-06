/**
 * Who can no longer make a suggested date (#85): someone added something to
 * their calendar after the date was offered, so it no longer works for them
 * by the event's own rules. My events warns about it, and counts it in the
 * badge when it is you.
 *
 * "By the event's own rules" is the engine's: each person is searched alone,
 * on exactly the date's span, with the settings the event was found with. If
 * that search still lands on the date, they can make it (perhaps by skipping
 * something on a calendar they marked skippable, or with work they'd take off
 * for a trip, which the date always asked of them); if it doesn't, something
 * now rules it out.
 *
 * Only for dates waiting for answers. A scheduled event is added to people's
 * calendars, and would then clash with itself.
 */
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { addDays, startOfDay } from "@/lib/zone";
import type { Participant } from "@/types";

/** The profile ids of `participants` who can't make `date` any more; none once it has passed. */
export function cantMake(
  participants: Participant[],
  settings: EventSettings,
  date: { start: string; end: string },
  timeZone: string,
  now = Date.now(),
): string[] {
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  if (end <= now) return [];
  // The stored date's text may be written differently ("+00:00" for "Z"), so
  // instants are compared, not strings.
  const iso = (ms: number) => new Date(ms).toISOString();
  // A meeting is searched on exactly its own time. Trips and holidays are
  // searched in whole days (a trip's search finds nothing in a window that
  // starts at 17:00), so their window is the days the date covers.
  const [from, to] =
    settings.kind === "single"
      ? [start, end]
      : [startOfDay(start, timeZone), addDays(startOfDay(end - 1, timeZone), 1, timeZone)];
  return participants
    .filter((p) => {
      const { slot } = findEventSlot([p], settings, iso(from), iso(to), timeZone);
      return !slot || Date.parse(slot.start) !== start || Date.parse(slot.end) !== end;
    })
    .map((p) => p.profileId);
}
