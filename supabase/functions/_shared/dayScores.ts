/**
 * Ranking a vote's dates by what they cost people's important events (#119),
 * the server's half.
 *
 * Each phone sends only what the rules need of its owner's important events
 * (DayFact: when it starts, how important it is, what to keep clear of the
 * night before, days to prepare): no title, no kind, no reason. This applies
 * the same plain rules as the browser's warnings (src/lib/eventWarnings.ts,
 * importantClashes) to every member's facts for a planned event and its dates,
 * and answers one score per date: never whose facts cost what.
 *
 * Edge Functions can't import from src/, so the rules are written out twice.
 * A set of cases both sides run (supabase/testdata/dayScoreCases.json, in
 * dayScores_test.ts and src/lib/dayFacts.test.ts) fails when they drift apart.
 */
import { type Effect, EFFECTS, type Strain } from "./eventVocabulary.ts";
import { DEFAULT_ZONE, offsetMinutes } from "./timezones.ts";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** How close before an important event counts as its night before. */
export const NIGHT_BEFORE_MS = 36 * HOUR_MS;
/** A night out ending before this hour belongs to the evening it began. */
export const NIGHT_ENDS_HOUR = 6;
/** At most this long, and light, is small enough for the day before a critical event. */
export const SMALL_MS = 2 * HOUR_MS;
/** From this long, an event counts as big. */
export const BIG_MS = 4 * HOUR_MS;
/** A meeting ending at this hour or later is a late night (src/lib/earlyMorning.ts). */
export const LATE_FROM_HOUR = 23;
/** A meeting that usually runs late and ends at this hour or later is one too. */
export const RUNS_LATE_FROM_HOUR = 21;

export const MAX_FACTS = 400;
export const MAX_PREP_DAYS = 14;

/** What the ranking needs to know of one important event of a person's. */
export interface DayFact {
  /** When it starts, epoch ms. */
  start: number;
  level: "high" | "critical";
  /** What to keep clear of the day or night before it. */
  avoid: Effect[];
  /** Whole days before it the person needs to prepare. */
  prepDays: number;
}

/**
 * A request's facts, or null if it isn't a list of them. Tidied rather than
 * trusted: each part is snapped into what it may be; a start in the distant
 * past or future is dropped, as it could never matter.
 */
export function readFacts(raw: unknown, now = Date.now()): DayFact[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FACTS) return null;
  const facts: DayFact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const f = item as Record<string, unknown>;
    if (typeof f.start !== "number" || !Number.isFinite(f.start)) return null;
    if (f.level !== "high" && f.level !== "critical") return null;
    const avoid = Array.isArray(f.avoid) ? f.avoid : [];
    const prep =
      typeof f.prepDays === "number" && Number.isFinite(f.prepDays) ? Math.round(f.prepDays) : 0;
    const start = Math.round(f.start);
    // A year ahead is as far as anything is planned; the last days are still near.
    if (start < now - 2 * DAY_MS || start > now + 400 * DAY_MS) continue;
    facts.push({
      start,
      level: f.level,
      avoid: EFFECTS.filter((e) => avoid.includes(e)),
      prepDays: Math.min(MAX_PREP_DAYS, Math.max(0, prep)),
    });
  }
  return facts;
}

/** What the planned event is likely to cause (the stored profile, #113), as far as ranking reads it. */
export interface PlannedProfile {
  effects: Effect[];
  runsLate: boolean;
  strain: Strain | null;
  recoveryDays: number;
}

/** What one date of the planned event does to the people going. */
export interface DateImpact {
  effects: Effect[];
  strain: Strain | null;
  recoveryDays: number;
  start: number;
  end: number;
}

/** The local day as a whole number, for counting days between two moments. */
function localDay(ms: number, zone: string): number {
  return Math.floor((ms + offsetMinutes(zone, ms) * MINUTE_MS) / DAY_MS);
}

/** Minutes since local midnight. */
function localMinute(ms: number, zone: string): number {
  const local = ms + offsetMinutes(zone, ms) * MINUTE_MS;
  return (((local % DAY_MS) + DAY_MS) % DAY_MS) / MINUTE_MS;
}

/** Whether `end` is at `hour` or later on the day `start` is on, past midnight included. */
function endsBy(start: number, end: number, hour: number, zone: string): boolean {
  return localDay(end, zone) > localDay(start, zone) || localMinute(end, zone) >= hour * 60;
}

/**
 * What the planned event does on one date (src/lib/eventImpact.ts, impactOn).
 * A meeting is a late night when the profile says so, when it ends at
 * LATE_FROM_HOUR or later, or when it usually runs late and ends at
 * RUNS_LATE_FROM_HOUR or later; trips and holidays take the profile's word.
 * Without a profile only the timing is known.
 */
export function impactOn(
  profile: PlannedProfile | null,
  date: { start: number; end: number },
  single: boolean,
  zone = DEFAULT_ZONE,
): DateImpact {
  const effects = new Set<Effect>(profile?.effects ?? []);
  if (single) {
    const endsLate = endsBy(date.start, date.end, LATE_FROM_HOUR, zone);
    const runsIntoNight =
      !!profile?.runsLate && endsBy(date.start, date.end, RUNS_LATE_FROM_HOUR, zone);
    if (endsLate || runsIntoNight) effects.add("lateNight");
  }
  return {
    effects: EFFECTS.filter((e) => effects.has(e)),
    strain: profile?.strain ?? null,
    recoveryDays: profile?.recoveryDays ?? 0,
    start: date.start,
    end: date.end,
  };
}

/** Tiring, drinking, late, or long: too much in the days before an exam. */
function isBig(impact: DateImpact): boolean {
  const length = impact.end - impact.start;
  if (impact.effects.length > 0 || length >= BIG_MS) return true;
  return impact.strain === "moderate" || impact.strain === "heavy";
}

/** Light and short: fine even the day before. Unknown strain counts as light. */
function isSmall(impact: DateImpact): boolean {
  const length = impact.end - impact.start;
  const light = impact.strain === null || impact.strain === "none" || impact.strain === "light";
  return light && impact.effects.length === 0 && length <= SMALL_MS;
}

export type Severity = "critical" | "warning";

/**
 * What the planned event, on this date, runs into among one person's
 * important events: the strongest of their clashes, or null (the rules of
 * src/lib/eventWarnings.ts, importantClashes). Critical events weigh
 * critical, high ones warn.
 */
export function strongestClash(
  impact: DateImpact,
  facts: DayFact[],
  zone = DEFAULT_ZONE,
): Severity | null {
  const lastDay = impact.end - 1 - NIGHT_ENDS_HOUR * HOUR_MS;
  let found: Severity | null = null;
  for (const fact of facts) {
    // Before the planned event ends, or during it: the calendar says so already.
    if (fact.start < impact.end) continue;
    const critical = fact.level === "critical";
    const daysAfter = localDay(fact.start, zone) - localDay(lastDay, zone);

    let severity: Severity | null = null;
    const avoids = fact.avoid.some((a) => impact.effects.includes(a));
    if (avoids && fact.start - impact.end <= NIGHT_BEFORE_MS) {
      severity = critical ? "critical" : "warning";
    }
    if (fact.prepDays >= 1 && daysAfter >= 1 && daysAfter <= fact.prepDays) {
      if (daysAfter === 1 && critical && !isSmall(impact)) {
        severity = "critical";
      } else if (isBig(impact) && severity === null) severity = "warning";
    }
    if (impact.recoveryDays >= 1 && daysAfter >= 1 && daysAfter <= impact.recoveryDays) {
      severity ??= "warning";
    }
    if (severity === "critical") return "critical";
    if (severity) found = severity;
  }
  return found;
}

/** What a person with a clash costs the group's score: a critical one fully, a warning less. */
export const PENALTY: Record<Severity, number> = { critical: 1, warning: 0.4 };

/**
 * How well a date suits the group, 0 to 100: each member costs the strongest
 * of their clashes, and the score is what is left of the whole group. A member
 * with no facts costs nothing, so a group where few have shared any is
 * scored on what is known, not on guesses. `factsByMember` has one list for
 * every member the event is for, empty for those with none.
 */
export function matchScore(
  impact: DateImpact,
  factsByMember: DayFact[][],
  zone = DEFAULT_ZONE,
): number {
  if (factsByMember.length === 0) return 100;
  const cost = factsByMember.reduce((sum, facts) => {
    const clash = strongestClash(impact, facts, zone);
    return sum + (clash ? PENALTY[clash] : 0);
  }, 0);
  return Math.round(100 * (1 - cost / factsByMember.length));
}
