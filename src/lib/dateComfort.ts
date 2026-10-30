/**
 * How good a date is for the people going, beyond being free (#178): the
 * small things a busy person weighs once the search has found the dates
 * everyone can make. Each rule is plain and cheap, and gives a penalty in one
 * unit, points of a bad date for one person: BIG (that person's date is
 * clearly bad), MEDIUM (they'd rather not), SMALL (a tiebreaker). A bonus is
 * a negative penalty.
 *
 * - Room on the day (meetings): little free time before it (less than 30
 *   minutes, 45 after work or school), or after it, or both (sandwiched).
 * - The night: ending at 22:00 or later before work, school or a `never`
 *   block early the next morning, worse when the event is a late or boozy one.
 * - A party on a school night (Sunday to Thursday); Friday and Saturday suit it.
 * - Ending after sunset when it needs daylight.
 * - Days of the year people keep for family (meetings): New Year's Eve in the
 *   day, the days around Christmas, Easter, Whitsun and so on. A trip over a
 *   long weekend is a bonus instead.
 * - Notice: too soon to plan around, and a gentle cost per week far ahead, so
 *   the rules never push every date to the end of the period.
 *
 * Calendars' priorities count: a block on a `skip` calendar is no neighbour
 * (it gives way), a `never` one weighs half again as much as a `normal` one,
 * and the holiday blocks (holidayBlocks.ts) are nobody's own plans.
 *
 * A date's cost is every person's own total added up, with the worst person
 * counted once more, so one person's bad day weighs more than a few mild
 * costs spread out. Rules about the date itself count for everyone. The
 * server's score (#119) joins in the same unit: what is missing from 100 is
 * that share of the group at BIG a person, so a critical clash is BIG and a
 * warning (0.4) MEDIUM.
 */
import type { EventImpact } from "@/api/eventProfile";
import { easterSunday } from "@/lib/danishHolidays";
import { impactOn } from "@/lib/eventImpact";
import { peopleForSearch, type EventSettings } from "@/lib/eventSearch";
import { addDays, atHour, localDate, startOfDay } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

export const BIG = 10;
export const MEDIUM = 4;
export const SMALL = 1;

/** Free minutes wanted before a meeting, and after work or school. */
const ROOM_MINUTES = 30;
const ROOM_AFTER_WORK_MINUTES = 45;
/** Little room after a meeting matters less than before it: leaving early is easier than arriving late. */
const AFTER_WEIGHT = 0.6;
/** A meeting ending at this hour or later is a late evening for the morning rule. */
const LATE_EVENING_HOUR = 22;
/** Work, school or a `never` block starting before this hour the next morning. */
const EARLY_MORNING_HOUR = 9;
/** How much worse the morning is when the event is a late night or has alcohol. */
const HEAVY_NIGHT_FACTOR = 1.5;
/** A `never` block next to a meeting weighs this much, a `normal` one 1. */
const NEVER_WEIGHT = 1.5;
/** Weeks ahead that cost nothing, and the cost of each one after. */
const FREE_WEEKS = 2;
const PER_WEEK = SMALL / 2;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** The longest a block is filed under its days: a stray multi-month block can't cost much. */
const MAX_DAYS_PER_BLOCK = 62;

/** Copenhagen, for sunset. */
const LATITUDE = 55.68;
const LONGITUDE = 12.57;

export type Rule =
  | "tightBefore"
  | "tightAfter"
  | "sandwiched"
  | "earlyAfterLate"
  | "schoolNight"
  | "afterDark"
  | "dayOfYear"
  | "notice"
  | "farAhead";

export interface Penalty {
  rule: Rule;
  points: number;
  /** The person it is about; none when it is about the date, which costs everyone. */
  who?: string;
}

export interface Comfort {
  /** Lower is better. */
  cost: number;
  penalties: Penalty[];
}

/** A busy block as the rules read it. */
interface Block {
  start: number;
  end: number;
  /** How much it counts as a neighbour: `normal` 1, `never` NEVER_WEIGHT. */
  weight: number;
  /** Work or school: wants more room after it, and is what an early morning is. */
  work: boolean;
  never: boolean;
}

/** A local day as a whole number, for filing blocks by day. */
const dayNumber = (ms: number, timeZone: string) => {
  const { year, month, day } = localDate(ms, timeZone);
  return Date.UTC(year, month, day) / DAY;
};

/** 1 when there is no room at all, falling to 0 at `wanted` minutes. */
const closeness = (gapMs: number, wantedMinutes: number) =>
  Math.max(0, 1 - gapMs / (wantedMinutes * 60_000));

/**
 * Each person's blocks filed by local day, the ones that count: a block on
 * a `skip` calendar gives way and a holiday block is nobody's own plans.
 */
function fileByDay(busy: BusyInterval[], timeZone: string): Map<number, Block[]> {
  const byDay = new Map<number, Block[]>();
  for (const b of busy) {
    if (b.holiday || b.priority === "skip") continue;
    const block: Block = {
      start: Date.parse(b.start),
      end: Date.parse(b.end),
      weight: b.priority === "never" ? NEVER_WEIGHT : 1,
      work: b.category === "work" || b.category === "school",
      never: b.priority === "never",
    };
    if (!(block.end > block.start)) continue;
    const first = dayNumber(block.start, timeZone);
    const last = Math.min(dayNumber(block.end - 1, timeZone), first + MAX_DAYS_PER_BLOCK);
    for (let d = first; d <= last; d++) {
      const list = byDay.get(d) ?? [];
      list.push(block);
      byDay.set(d, list);
    }
  }
  return byDay;
}

/**
 * Sunset in Copenhagen on the local day starting at `midnight` (NOAA's
 * approximation, within a couple of minutes), as an instant.
 */
export function sunset(midnight: number, timeZone: string): number {
  const { year, month, day } = localDate(midnight, timeZone);
  const dayOfYear = (Date.UTC(year, month, day) - Date.UTC(year, 0, 1)) / DAY + 1;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + 0.5);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const lat = (LATITUDE * Math.PI) / 180;
  const cosHa =
    Math.cos((90.833 * Math.PI) / 180) / (Math.cos(lat) * Math.cos(decl)) -
    Math.tan(lat) * Math.tan(decl);
  const ha = (Math.acos(Math.min(1, Math.max(-1, cosHa))) * 180) / Math.PI;
  const minutesUtc = 720 - 4 * (LONGITUDE - ha) - eqTime;
  return Date.UTC(year, month, day) + minutesUtc * 60_000;
}

/** Days from Easter Sunday to a calendar date (negative before it). */
function fromEaster(year: number, month: number, day: number): number {
  const easter = easterSunday(year);
  return (Date.UTC(year, month, day) - Date.UTC(year, easter.month, easter.day)) / DAY;
}

/**
 * Days kept for family or travel, for a meeting on the local date given:
 * BIG, MEDIUM or 0. The evenings blocked outright (holidayBlocks.ts) never
 * reach here; their days do.
 */
function familyDay(
  date: { year: number; month: number; day: number },
  endsEvening: boolean,
): number {
  const { year, month, day } = date;
  if (month === 11 && day === 31) return BIG;
  if (month === 11 && [22, 27, 28, 29, 30].includes(day)) return MEDIUM;
  if (month === 0 && day === 1) return MEDIUM;
  // Easter (Maundy Thursday to Easter Monday), Ascension and the Friday
  // after it, Whitsun (its Saturday to Whit Monday).
  if ([-3, -2, -1, 0, 1, 39, 40, 48, 49, 50].includes(fromEaster(year, month, day))) return MEDIUM;
  // Mother's Day, the second Sunday in May.
  const may1 = new Date(Date.UTC(year, 4, 1)).getUTCDay();
  if (month === 4 && day === 1 + ((7 - may1) % 7) + 7) return MEDIUM;
  // Constitution Day, which is Father's Day too.
  if (month === 5 && day === 5) return MEDIUM;
  // Sankt Hans aften: the bonfires are in the evening.
  if (month === 5 && day === 23 && endsEvening) return MEDIUM;
  return 0;
}

/** Whether a trip's days take in Ascension or Whitsun: fewer days off for the same trip. */
function overLongWeekend(start: number, end: number, timeZone: string): boolean {
  for (let d = startOfDay(start, timeZone); d < end; d = addDays(d, 1, timeZone)) {
    const { year, month, day } = localDate(d, timeZone);
    if ([39, 49].includes(fromEaster(year, month, day))) return true;
  }
  return false;
}

/**
 * A rater for the dates of one search: the participants' busy times are
 * filed by day once, so each date costs a few lookups. `score` is the
 * server's (#119), if there is one.
 */
export function comfortRater({
  participants,
  settings,
  profile,
  timeZone,
  now,
}: {
  participants: Participant[];
  settings: EventSettings;
  profile?: EventImpact | null;
  timeZone: string;
  now: number;
}): (slot: { start: string; end: string }, score?: number) => Comfort {
  // Only the people the search is for (peopleForSearch): the required ones.
  const people = peopleForSearch(participants, settings.people).searched.map((p) => ({
    id: p.profileId,
    days: fileByDay(p.busy, timeZone),
  }));
  const meeting = settings.kind === "single";

  return (slot, score) => {
    const start = Date.parse(slot.start);
    const end = Date.parse(slot.end);
    const startDate = localDate(start, timeZone);
    const impact = impactOn(profile, slot, settings, timeZone);
    const heavyNight = impact.effects.includes("lateNight") || impact.effects.includes("alcohol");
    const penalties: Penalty[] = [];
    const add = (rule: Rule, points: number, who?: string) => {
      if (points !== 0) penalties.push({ rule, points, ...(who !== undefined && { who }) });
    };

    // About the date itself: everyone's.
    if (meeting) {
      if (heavyNight) add("schoolNight", startDate.dow <= 4 ? MEDIUM : -2 * SMALL);
      if (impact.daylight && end > sunset(startOfDay(start, timeZone), timeZone)) {
        add("afterDark", BIG);
      }
      add("dayOfYear", familyDay(startDate, end > atHour(start, 18, timeZone)));
    } else if (overLongWeekend(start, end, timeZone)) {
      add("dayOfYear", -MEDIUM);
    }
    const lead = start - now;
    if (lead >= 0) {
      const [big, medium] = meeting ? [DAY, 2 * DAY] : [WEEK, 2 * WEEK];
      add("notice", lead < big ? BIG : lead < medium ? MEDIUM : 0);
      add("farAhead", Math.max(0, lead / WEEK - FREE_WEEKS) * PER_WEEK);
    }

    // About each person's own day.
    if (meeting) {
      const morning =
        dayNumber(end, timeZone) === dayNumber(start, timeZone)
          ? addDays(start, 1, timeZone)
          : startOfDay(end, timeZone);
      const wake = atHour(morning, EARLY_MORNING_HOUR, timeZone);
      const endsLate = end >= atHour(start, LATE_EVENING_HOUR, timeZone);
      for (const person of people) {
        const today = person.days.get(dayNumber(start, timeZone)) ?? [];
        // The nearest block ending before it starts, and starting after it ends, the same day.
        let before: { gap: number; block: Block } | null = null;
        for (const b of today) {
          if (b.end > start) continue;
          const gap = start - b.end;
          if (
            !before ||
            gap < before.gap ||
            (gap === before.gap && b.weight > before.block.weight)
          ) {
            before = { gap, block: b };
          }
        }
        let after: { gap: number; block: Block } | null = null;
        const endDay = addDays(end - 1, 1, timeZone);
        for (const b of person.days.get(dayNumber(end - 1, timeZone)) ?? []) {
          if (b.start < end || b.start >= endDay) continue;
          const gap = b.start - end;
          if (!after || gap < after.gap || (gap === after.gap && b.weight > after.block.weight)) {
            after = { gap, block: b };
          }
        }
        const tightBefore = before
          ? closeness(before.gap, before.block.work ? ROOM_AFTER_WORK_MINUTES : ROOM_MINUTES)
          : 0;
        const tightAfter = after ? closeness(after.gap, ROOM_MINUTES) : 0;
        add("tightBefore", MEDIUM * tightBefore * (before?.block.weight ?? 1), person.id);
        add(
          "tightAfter",
          MEDIUM * AFTER_WEIGHT * tightAfter * (after?.block.weight ?? 1),
          person.id,
        );
        add("sandwiched", MEDIUM * Math.min(tightBefore, tightAfter), person.id);

        if (endsLate) {
          const early = (person.days.get(dayNumber(morning, timeZone)) ?? []).some(
            (b) => b.start >= end && b.start < wake && (b.work || b.never),
          );
          if (early) add("earlyAfterLate", BIG * (heavyNight ? HEAVY_NIGHT_FACTOR : 1), person.id);
        }
      }
    }

    // Each person's total, the date's own penalties counted for everyone.
    const shared = penalties.filter((p) => p.who === undefined).reduce((s, p) => s + p.points, 0);
    const totals = (people.length > 0 ? people : [{ id: "" }]).map(
      (person) =>
        shared + penalties.filter((p) => p.who === person.id).reduce((s, p) => s + p.points, 0),
    );
    const fromScore = score === undefined ? 0 : ((100 - score) / 100) * people.length * BIG;
    return {
      cost: totals.reduce((s, t) => s + t, 0) + Math.max(...totals) + fromScore,
      penalties,
    };
  };
}
