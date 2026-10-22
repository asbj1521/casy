/**
 * What this phone tells Casy about its owner's important events, for ranking a
 * vote's dates (#119): per event only when it starts, how important it is,
 * what to keep clear of the night before and the days it needs to prepare.
 * Never the title, the kind or the reason: the labels stay on the phone, and
 * the server combines everyone's facts into one score per date, never whose.
 *
 * The server's rules for them are supabase/functions/_shared/dayScores.ts,
 * the same as importantClashes (eventWarnings.ts); dayFacts.test.ts runs the
 * cases both share.
 */
import type { Effect } from "@/lib/eventVocabulary";
import type { LabelledEvent } from "@/lib/eventWarnings";

export interface DayFact {
  /** When it starts, epoch ms, to the minute. */
  start: number;
  level: "high" | "critical";
  avoid: Effect[];
  prepDays: number;
}

/** The most the server takes at once. */
export const MAX_FACTS = 400;

const MINUTE_MS = 60_000;

/**
 * The facts of this phone's important events that are still to come, soonest
 * first: only high and critical ones ever cost a date anything.
 */
export function dayFactsOf(events: LabelledEvent[], now: number): DayFact[] {
  return events
    .filter(
      (e) => e.start > now && (e.label.importance === "high" || e.label.importance === "critical"),
    )
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_FACTS)
    .map((e) => ({
      start: Math.round(e.start / MINUTE_MS) * MINUTE_MS,
      level: e.label.importance === "critical" ? ("critical" as const) : ("high" as const),
      avoid: [...e.label.avoidBefore],
      prepDays: e.label.prepDays,
    }));
}
