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
 * look free whatever their week is like. Only groups of MIN_GROUP_SIZE or
 * more: two or three friends find time on their own, a bigger group is
 * where plans need help getting going.
 */
import { ANY_TIME_EARLIEST_HOUR, ANY_TIME_LATEST_HOUR } from "@/lib/eventSearch";
import { holidayBlocks } from "@/lib/holidayBlocks";
import { ALL_DOWS, type SchedulerSettings } from "@/lib/scheduler";
import { addDays, atHour, dayOfWeek, localDate, startOfDay } from "@/lib/zone";

/** How far ahead it looks, from tomorrow: soon enough to be spontaneous. */
export const LOOK_AHEAD_DAYS = 21;
/** The shortest stretch worth a star. */
export const MIN_HOURS = 4;
/** The smallest group that gets stars. */
export const MIN_GROUP_SIZE = 4;
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
 * a group under MIN_GROUP_SIZE, one with a member with no calendar, or one
 * already voting.
 */
export function primeCandidates(group: PrimeGroup, now: number, timeZone: string): PrimeDate[] {
  if (group.memberIds.length < MIN_GROUP_SIZE || group.voting) return [];
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

/** How long a plan for a stretch starts out: an ordinary get-together, changed in Planlæg. */
const PLAN_MINUTES = 3 * 60;

/**
 * How a stretch is said: a weekend, the whole day (10:00 to 22:00), from
 * an hour until the evening's end ("fra 17:00"), or between two hours.
 */
export function stretchShape(
  prime: PrimeDate,
  timeZone: string,
): "weekend" | "allDay" | "from" | "between" {
  if (prime.kind === "weekend") return "weekend";
  const toEnd = prime.end === atHour(prime.day, ANY_TIME_LATEST_HOUR, timeZone);
  if (!toEnd) return "between";
  return prime.start === atHour(prime.day, ANY_TIME_EARLIEST_HOUR, timeZone) ? "allDay" : "from";
}

/**
 * Planlæg's settings for a prime date: that day only (#134's exact days),
 * any time in it for PLAN_MINUTES, so the search finds when that fits
 * everyone (a stretch is never filled end to end: a whole free day is no
 * twelve-hour plan); a weekend is Saturday and Sunday away together. The
 * stretch's first whole hour is kept for a time picked by hand. The group is
 * chosen beside it.
 */
export function primeDatePlan(prime: PrimeDate, timeZone: string): Partial<SchedulerSettings> {
  const day = new Date(prime.day).toISOString();
  if (prime.kind === "weekend") {
    const sunday = new Date(addDays(prime.day, 1, timeZone)).toISOString();
    return { multiDay: true, days: 2, startDow: 6, period: { from: day, to: sunday, days: true } };
  }
  return {
    multiDay: false,
    anyTime: true,
    startWindow: null,
    startHour: Math.ceil((prime.start - startOfDay(prime.start, timeZone)) / HOUR),
    durationMinutes: PLAN_MINUTES,
    dows: [...ALL_DOWS],
    period: { from: day, to: day, days: true },
  };
}
