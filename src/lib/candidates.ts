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
 * Within each group, the dates are taken best first by what they cost the
 * people going (#178, dateComfort.ts): room around the event, the night
 * before work, the days kept for family, notice, and the server's score of
 * everyone's important events (#119), all in one unit; soonest first on a
 * tie. The costly dates go by fewest people giving something up, then by
 * that cost. The clean dates are still taken before any that cost someone,
 * and the spacing rules still hold.
 *
 * 1 January (#166, newYear.ts): a big plan there is never offered unless it
 * is the date on screen, and a small one only after every other date in its
 * group (clean, or costing someone).
 *
 * Every date comes from the same search the page and a decline run
 * (findEventSlot), stepped forward a day (a meeting or trip) or past the end
 * (a holiday) at a time, so each is one the page itself could have shown.
 */
import type { EventImpact } from "@/api/eventProfile";
import { comfortRater, type Comfort } from "@/lib/dateComfort";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { bigOnNewYearsDay, onNewYearsDay } from "@/lib/newYear";
import type { FoundDate } from "@/lib/scheduler";
import { addDays, dayOf, localDate } from "@/lib/zone";
import type { Participant } from "@/types";

/** How many dates a vote offers, when there are that many good ones. */
const CANDIDATE_COUNT = 5;

/** The fewest days between two meetings offered in one vote. */
const MEETING_GAP_DAYS = 2;

/** How many dates are looked at before choosing: plenty to spread over, and quick. */
const MAX_LOOKED_AT = 60;

interface CandidateOptions {
  /** The date on screen: always offered, first. Later dates are searched from after it. */
  first: FoundDate;
  /** Where the period searched ends (exclusive). */
  end: string;
  count?: number;
  /** How well each date suits the group (0 to 100), by the start of its slot (#119). */
  scores?: ReadonlyMap<string, number>;
  /** What the event does (#113): a big plan on 1 January (#166), and what the comfort rules read (#178). */
  profile?: EventImpact | null;
  /** The time now, for how much notice a date gives (#178); Date.now() unless a test says. */
  now?: number;
}

export function pickCandidates(
  participants: Participant[],
  search: EventSettings,
  options: CandidateOptions,
  timeZone: string,
): FoundDate[] {
  return rankCandidates(participants, search, options, timeZone).chosen;
}

/**
 * Everything the search offers after the first date, in order: the dates a
 * vote is picked from. Also what the server is asked to score (#119), so the
 * scores can be in hand before the picking.
 */
export function findPool(
  participants: Participant[],
  search: EventSettings,
  options: CandidateOptions,
  timeZone: string,
): FoundDate[] {
  const { first, end } = options;
  const found: FoundDate[] = [];
  let from = nextSearchStart(search, first, timeZone);
  while (found.length < MAX_LOOKED_AT && Date.parse(from) < Date.parse(end)) {
    const { slot, conflicts } = findEventSlot(participants, search, from, end, timeZone);
    if (!slot) break;
    const date = { slot, conflicts };
    found.push(date);
    from = nextSearchStart(search, date, timeZone);
  }
  return found;
}

/**
 * pickCandidates, with every date it looked at (`pool`: the first, then the
 * rest soonest first) beside the ones it chose, soonest first (`chosen`) and
 * in the order it chose them (`byPick`: best first, by the rules above). The
 * paper pile (#126) lists the pool and ranks it by that order.
 */
export function rankCandidates(
  participants: Participant[],
  search: EventSettings,
  options: CandidateOptions,
  timeZone: string,
): RankedDates {
  const pool = findPool(participants, search, options, timeZone);
  return rankFromPool(pool, participants, search, options, timeZone);
}

/** What the ranking made of a pool: the dates, and what each cost the people going (#178). */
export interface RankedDates {
  pool: FoundDate[];
  chosen: FoundDate[];
  byPick: FoundDate[];
  /** Each date's cost and the penalties it is made of, the date on screen's too. */
  comfort: Map<FoundDate, Comfort>;
}

/** rankCandidates over a pool already searched (findPool), so scores can be fetched in between. */
export function rankFromPool(
  found: FoundDate[],
  participants: Participant[],
  search: EventSettings,
  options: CandidateOptions,
  timeZone: string,
): RankedDates {
  const { first, count = CANDIDATE_COUNT, scores, profile, now = Date.now() } = options;

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

  // What each date costs the people going (#178), the server's score in it;
  // the sorts are stable, so equal costs stay soonest first.
  const rate = comfortRater({ participants, settings: search, profile, timeZone, now });
  const comfort = new Map(
    [first, ...found].map((d) => [d, rate(d.slot, scores?.get(d.slot.start))] as const),
  );
  const costOf = (d: FoundDate) => comfort.get(d)?.cost ?? 0;
  // 1 January: a big plan is left out, a small one goes last in its group
  // (the sort is stable, so the rest keep their order).
  const offered = found.filter((d) => !bigOnNewYearsDay(profile, d.slot, search, timeZone));
  const newYearLast = (a: FoundDate, b: FoundDate) =>
    Number(onNewYearsDay(a.slot.start, timeZone)) - Number(onNewYearsDay(b.slot.start, timeZone));
  const clean = offered
    .filter((d) => d.conflicts.length === 0)
    .sort((a, b) => costOf(a) - costOf(b))
    .sort(newYearLast);
  // Fewest people giving something up first, then by cost.
  const costly = offered
    .filter((d) => d.conflicts.length > 0)
    .sort((a, b) => a.conflicts.length - b.conflicts.length || costOf(a) - costOf(b))
    .sort(newYearLast);
  take(clean, { also: newWeekday });
  take(clean);
  take(costly, { also: newWeekday });
  take(costly);
  take(clean, { gap: 1 });
  take(costly, { gap: 1 });

  return {
    pool: [first, ...found],
    comfort,
    byPick: [...chosen],
    chosen: chosen.sort((a, b) => Date.parse(a.slot.start) - Date.parse(b.slot.start)),
  };
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
