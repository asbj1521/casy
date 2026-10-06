/**
 * Which dates a vote offers (#74): the date on the scheduling page, and a
 * few more good ones after it within the period searched, so the group
 * answers once instead of declining its way through dates one at a time.
 *
 * "Good" in this order:
 *
 * 1. Dates everyone can make as things stand (no conflicts), before dates
 *    that need someone to skip something or take time off, which only fill
 *    up what clean dates can't.
 * 2. Spread out: meetings at least MEETING_GAP_DAYS apart and, where
 *    possible, on weekdays not offered yet, so "Wednesday is bad for me"
 *    doesn't rule out every date at once; trips and holidays never overlap.
 *    Only if a short period leaves too few dates that way do meetings on
 *    days next to each other fill up (never two on one day).
 * 3. Soonest first, within those rules.
 *
 * Every date comes from the same search the page and a decline run
 * (findEventSlot), stepped forward a day (a meeting or trip) or past the end
 * (a holiday) at a time, so each is one the page itself could have shown.
 */
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import type { FoundDate } from "@/lib/scheduler";
import { addDays, dayOf, localDate } from "@/lib/zone";
import type { Participant } from "@/types";

/** How many dates a vote offers, when there are that many good ones. */
export const CANDIDATE_COUNT = 5;

/** The fewest days between two meetings offered in one vote. */
const MEETING_GAP_DAYS = 2;

/** How many dates are looked at before choosing: plenty to spread over, and quick. */
const MAX_LOOKED_AT = 60;

export function pickCandidates(
  participants: Participant[],
  search: EventSettings,
  options: {
    /** The date on screen: always offered, first. Later dates are searched from after it. */
    first: FoundDate;
    /** Where the period searched ends (exclusive). */
    end: string;
    count?: number;
  },
  timeZone: string,
): FoundDate[] {
  const { first, end, count = CANDIDATE_COUNT } = options;

  // Everything the search would offer after the first date, in order.
  const found: FoundDate[] = [];
  let from = nextSearchStart(search, first, timeZone);
  while (found.length < MAX_LOOKED_AT && Date.parse(from) < Date.parse(end)) {
    const { slot, conflicts } = findEventSlot(participants, search, from, end, timeZone);
    if (!slot) break;
    const date = { slot, conflicts };
    found.push(date);
    from = nextSearchStart(search, date, timeZone);
  }

  const chosen: FoundDate[] = [first];
  const dayNumber = (d: FoundDate) => dayIndex(d.slot.start, timeZone);
  const fits = (d: FoundDate, gap: number) =>
    chosen.every((c) =>
      search.kind === "single"
        ? Math.abs(dayNumber(c) - dayNumber(d)) >= gap
        : Date.parse(d.slot.start) >= Date.parse(c.slot.end) ||
          Date.parse(d.slot.end) <= Date.parse(c.slot.start),
    );
  const weekday = (d: FoundDate) => localDate(Date.parse(d.slot.start), timeZone).dow;
  const newWeekday = (d: FoundDate) => chosen.every((c) => weekday(c) !== weekday(d));
  const take = (
    pool: FoundDate[],
    {
      gap = MEETING_GAP_DAYS,
      also = () => true,
    }: { gap?: number; also?: (d: FoundDate) => boolean } = {},
  ) => {
    for (const d of pool) {
      if (chosen.length >= count) return;
      if (!chosen.includes(d) && fits(d, gap) && also(d)) chosen.push(d);
    }
  };

  const clean = found.filter((d) => d.conflicts.length === 0);
  // Fewest people giving something up first, then soonest.
  const costly = found
    .filter((d) => d.conflicts.length > 0)
    .sort((a, b) => a.conflicts.length - b.conflicts.length);
  take(clean, { also: newWeekday });
  take(clean);
  take(costly, { also: newWeekday });
  take(costly);
  take(clean, { gap: 1 });
  take(costly, { gap: 1 });

  return chosen.sort((a, b) => Date.parse(a.slot.start) - Date.parse(b.slot.start));
}

/**
 * Where the search for the date after `date` starts: a holiday's end (the
 * next one can't overlap it), else the local day after it starts.
 */
function nextSearchStart(search: EventSettings, date: FoundDate, timeZone: string): string {
  if (search.kind === "vacation") return date.slot.end;
  const day = Date.parse(dayOf(date.slot.start, timeZone));
  return new Date(addDays(day, 1, timeZone)).toISOString();
}

/** A local day as a whole number, for counting days between two dates. */
function dayIndex(iso: string, timeZone: string): number {
  const { year, month, day } = localDate(Date.parse(iso), timeZone);
  return Date.UTC(year, month, day) / 86_400_000;
}
