/**
 * Tid til hinanden (#171): times in the next few weeks when everyone in a
 * group is free for a real stretch, found by Casy without anyone asking, so
 * seeing each other is one tap away. The point is to make people take the
 * time, so it looks for the good ones: a whole Saturday before a weekday
 * evening, and a free weekend most of all.
 *
 * Worked out on the phone from each group's busy times (the same the
 * scheduler searches), never stored. Only real stretches count: inside the
 * scheduler's own hours (10:00 to 22:00), at least MIN_HOURS, no Christmas
 * or New Year, and nothing the group already has suggested or planned near
 * it. A group with a member who has no calendar has none: that member would
 * look free whatever their week is like.
 */
import { ANY_TIME_EARLIEST_HOUR, ANY_TIME_LATEST_HOUR } from "@/lib/eventSearch";
import { holidayBlocks } from "@/lib/holidayBlocks";
import { ALL_DOWS, type SchedulerSettings } from "@/lib/scheduler";
import { addDays, atHour, dayOfWeek, localDate, startOfDay } from "@/lib/zone";

/** How far ahead it looks, from tomorrow: soon enough to be spontaneous. */
export const LOOK_AHEAD_DAYS = 21;
/** The shortest stretch worth a star. */
export const MIN_HOURS = 4;
/** How many days around the group's own events stay out: they are already seeing each other. */
const NEAR_DAYS = 3;
/** How many show at once, across every group: a few good ones, not a starry sky. */
export const MAX_PRIME_DATES = 3;

const HOUR = 3_600_000;
const HALF_HOUR = HOUR / 2;

export interface PrimeDate {
  groupId: string;
  /** "hours": a stretch of one day; "weekend": a whole Saturday and Sunday. */
  kind: "hours" | "weekend";
  /** Its first day's local midnight: where the star goes. */
  day: number;
  start: number;
  end: number;
  /** How good it is before the day scores, for ranking. */
  value: number;
}

/** What primeCandidates needs to know of a group. */
export interface PrimeGroup {
  id: string;
  memberIds: string[];
  /** Each member's busy times, by profile id (the groups function's `busy`). */
  busy: Record<string, { start: string; end: string }[]>;
  /** Whether each member has a calendar at all. */
  connected: Record<string, boolean>;
  /** Every date the group's events have suggested or agreed. */
  eventDates: { start: string; end: string }[];
  /** A vote of the group's is still open: they are planning already. */
  voting: boolean;
}

interface Span {
  start: number;
  end: number;
}

/** The free gaps between `from` and `to` around `busy` (in any order, overlapping or not). */
export function freeGaps(busy: Span[], from: number, to: number): Span[] {
  const sorted = busy.filter((b) => b.end > from && b.start < to).sort((a, b) => a.start - b.start);
  const gaps: Span[] = [];
  let at = from;
  for (const b of sorted) {
    if (b.start > at) gaps.push({ start: at, end: Math.min(b.start, to) });
    at = Math.max(at, b.end);
    if (at >= to) break;
  }
  if (at < to) gaps.push({ start: at, end: to });
  return gaps;
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;
const toSpan = (b: { start: string; end: string }): Span => ({
  start: Date.parse(b.start),
  end: Date.parse(b.end),
});

/**
 * Every stretch the whole group is free for, best first: at most one a day
 * (its longest), and a weekend where both its days are wholly free. None for
 * a group of one, one with a member with no calendar, or one already voting.
 */
export function primeCandidates(group: PrimeGroup, now: number, timeZone: string): PrimeDate[] {
  if (group.memberIds.length < 2 || group.voting) return [];
  if (group.memberIds.some((id) => !group.connected[id])) return [];

  // Only what falls in the weeks looked at: the busy times reach a year ahead.
  const looked = { start: now, end: addDays(now, LOOK_AHEAD_DAYS + 2, timeZone) };
  const busy = group.memberIds
    .flatMap((id) => (group.busy[id] ?? []).map(toSpan))
    .filter((b) => overlaps(b, looked));
  const { year } = localDate(now, timeZone);
  const holidays = holidayBlocks([year, year + 1], timeZone).map(toSpan);
  const events = group.eventDates.map(toSpan);

  const found: PrimeDate[] = [];
  // Which days ahead (1 is tomorrow) are free from 10:00 to 22:00, for the weekends.
  const wholeDay = new Map<number, number>();
  for (let ahead = 1; ahead <= LOOK_AHEAD_DAYS; ahead++) {
    const day = addDays(now, ahead, timeZone);
    const dayNext = addDays(now, ahead + 1, timeZone);
    if (holidays.some((h) => overlaps(h, { start: day, end: dayNext }))) continue;
    const near = {
      start: addDays(day, -NEAR_DAYS, timeZone),
      end: addDays(day, NEAR_DAYS + 1, timeZone),
    };
    if (events.some((e) => overlaps(e, near))) continue;

    const from = atHour(day, ANY_TIME_EARLIEST_HOUR, timeZone);
    const to = atHour(day, ANY_TIME_LATEST_HOUR, timeZone);
    const gaps = freeGaps(busy, from, to);
    if (gaps.length === 1 && gaps[0].start === from && gaps[0].end === to) wholeDay.set(ahead, day);
    // The day's longest gap, on the hour or the half hour (Denmark's offset is whole hours).
    const longest = gaps
      .map((g) => ({
        start: Math.ceil(g.start / HALF_HOUR) * HALF_HOUR,
        end: Math.floor(g.end / HALF_HOUR) * HALF_HOUR,
      }))
      .reduce<Span | null>(
        (best, g) => (!best || g.end - g.start > best.end - best.start ? g : best),
        null,
      );
    if (!longest || longest.end - longest.start < MIN_HOURS * HOUR) continue;
    found.push({
      groupId: group.id,
      kind: "hours",
      day,
      ...longest,
      value: hoursValue(longest, day, ahead, timeZone),
    });
  }

  // A free Saturday with a free Sunday after it: room to go somewhere together.
  for (const [ahead, day] of wholeDay) {
    const sunday = wholeDay.get(ahead + 1);
    if (dayOfWeek(day, timeZone) !== 6 || sunday === undefined) continue;
    found.push({
      groupId: group.id,
      kind: "weekend",
      day,
      start: atHour(day, ANY_TIME_EARLIEST_HOUR, timeZone),
      end: atHour(sunday, ANY_TIME_LATEST_HOUR, timeZone),
      value: 1.6 * soonness(ahead),
    });
  }
  return found.sort((a, b) => b.value - a.value);
}

/** Sooner is a little better: the last day looked at is worth 70 % of tomorrow. */
function soonness(ahead: number): number {
  return 1 - (0.3 * (ahead - 1)) / LOOK_AHEAD_DAYS;
}

/**
 * A stretch of one day: longer is better (the whole 10:00 to 22:00 is 1), a
 * Saturday or Sunday better still, an evening after work on a weekday less so.
 */
function hoursValue(stretch: Span, day: number, ahead: number, timeZone: string): number {
  const dow = dayOfWeek(day, timeZone);
  const weekend = dow === 0 || dow === 6;
  const evening = !weekend && stretch.start >= atHour(day, 17, timeZone);
  const length =
    (stretch.end - stretch.start) / HOUR / (ANY_TIME_LATEST_HOUR - ANY_TIME_EARLIEST_HOUR);
  return length * (weekend ? 1.3 : 1) * (evening ? 0.7 : 1) * soonness(ahead);
}

/**
 * The few to show: each group's best, the day scores (#119, 0 to 100, by
 * the start) counting where there are any, then the best of those, at most
 * MAX_PRIME_DATES. A low score halves a stretch's worth: an exam the next
 * morning makes a free evening much less of one.
 */
export function pickPrimeDates(
  candidates: PrimeDate[][],
  scores?: ReadonlyMap<string, ReadonlyMap<number, number>>,
): PrimeDate[] {
  const worth = (p: PrimeDate) => {
    const score = scores?.get(p.groupId)?.get(p.start);
    return score === undefined ? p.value : p.value * (0.5 + score / 200);
  };
  return candidates
    .flatMap((list) => {
      const best = list.reduce<PrimeDate | null>(
        (top, p) => (!top || worth(p) > worth(top) ? p : top),
        null,
      );
      return best ? [{ ...best, value: worth(best) }] : [];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_PRIME_DATES);
}

/** The longest meeting Planlæg can be set to (its lengths, schedulerSettings/options.ts). */
const LONGEST_MINUTES = 12 * 60;

/**
 * Planlæg's settings for a prime date: that day only (#134's exact days),
 * from the stretch's first whole hour for as long as it lasts (a weekend:
 * Saturday and Sunday away together). The group is chosen beside it.
 */
export function primeDatePlan(prime: PrimeDate, timeZone: string): Partial<SchedulerSettings> {
  const day = new Date(prime.day).toISOString();
  if (prime.kind === "weekend") {
    const sunday = new Date(addDays(prime.day, 1, timeZone)).toISOString();
    return { multiDay: true, days: 2, startDow: 6, period: { from: day, to: sunday, days: true } };
  }
  const startHour = Math.ceil((prime.start - startOfDay(prime.start, timeZone)) / HOUR);
  const minutes = (prime.end - atHour(prime.day, startHour, timeZone)) / 60_000;
  return {
    multiDay: false,
    anyTime: false,
    startWindow: null,
    startHour,
    durationMinutes: Math.min(LONGEST_MINUTES, Math.floor(minutes / 30) * 30),
    dows: [...ALL_DOWS],
    period: { from: day, to: day, days: true },
  };
}

/**
 * What the ideas for a prime date are asked from (the prime-ideas function,
 * _shared/ideasAi.ts): when it is and how long, the weekday, the month, how
 * many are in the group and what the group is for. Nothing else.
 */
export interface PrimeStretch {
  kind: PrimeDate["kind"];
  startMinute: number;
  minutes: number;
  weekday: number;
  month: number;
  groupSize: number;
  about: string;
}

export function primeStretch(
  prime: PrimeDate,
  group: { size: number; about: string | null },
  timeZone: string,
): PrimeStretch {
  const { month, dow } = localDate(prime.day, timeZone);
  return {
    kind: prime.kind,
    startMinute: Math.round((prime.start - startOfDay(prime.start, timeZone)) / 60_000),
    // A weekend is whole days: its length says nothing the kind doesn't.
    minutes:
      prime.kind === "weekend"
        ? (ANY_TIME_LATEST_HOUR - ANY_TIME_EARLIEST_HOUR) * 60
        : Math.round((prime.end - prime.start) / 60_000),
    weekday: dow,
    month,
    groupSize: group.size,
    about: group.about ?? "",
  };
}
