/**
 * What a planned event does (#113), the browser's half: the scheduler's
 * settings turned into what the profile is asked about (profileInput), and
 * the profile turned into what one date of the event does (impactOn).
 *
 * The AI only judges what the event is (a julefrokost means alcohol and a
 * late night), once, whatever the date; what follows from a date is worked
 * out here, exactly. That keeps one profile good for every date of a vote,
 * and an "any time" meeting's dates each get their own answer.
 *
 * impactOn is the one thing the warnings (#114) and the ranking of a vote's
 * dates (#119) read: never the profile's fields directly, so the profile can
 * change behind it.
 */
import type { EventImpact, EventToProfile } from "@/api/eventProfile";
import { LATE_FROM_HOUR } from "@/lib/earlyMorning";
import type { EventSettings } from "@/lib/eventSearch";
import { EFFECTS, type Effect, type Strain } from "@/lib/eventVocabulary";
import { atHour } from "@/lib/zone";

/**
 * A meeting that usually runs late (runsLate) and is planned to end at this
 * hour or later is taken to become a late night (LATE_FROM_HOUR) anyway.
 */
export const RUNS_LATE_FROM_HOUR = 21;

/** What is asked about: the event as set up, with only what its suggester typed. */
export function profileInput(
  settings: EventSettings,
  title: string,
  place: string,
  note: string,
): EventToProfile {
  const typed = { title: title.trim(), place: place.trim(), note: note.trim() };
  if (settings.kind === "single") {
    return {
      ...typed,
      kind: "meeting",
      startMinute: settings.anyTime ? -1 : Math.round(settings.startHour * 60),
      minutes: settings.durationMinutes,
      days: 1,
    };
  }
  return {
    ...typed,
    kind: settings.kind === "trip" ? "trip" : "holiday",
    startMinute: -1,
    minutes: 0,
    days: settings.kind === "trip" ? settings.shape.spanDays : settings.days,
  };
}

/** What one date of the event does to the people going. */
export interface DateImpact {
  /** False when there was no profile: only what the date's timing says is known. */
  profiled: boolean;
  /** What it causes, the date's own late night included. */
  effects: Effect[];
  /** How tiring it is; null when not known (no profile). */
  strain: Strain | null;
  recoveryDays: number;
  outdoors: boolean;
  daylight: boolean;
  /** When it starts and ends, epoch ms. */
  start: number;
  end: number;
}

/**
 * What the event does on the date from `start` to `end` (ISO). A meeting is
 * a late night when the profile says so, when it ends at LATE_FROM_HOUR or
 * later (or past midnight), or when it usually runs late and is planned to
 * end at RUNS_LATE_FROM_HOUR or later. Trips and holidays take the profile's
 * word: their timing is whole days, which says nothing about the nights.
 * Without a profile only the timing is known: a late ending is still a late
 * night, and nothing else is claimed (`profiled` false, strain unknown).
 */
export function impactOn(
  profile: EventImpact | null | undefined,
  date: { start: string; end: string },
  settings: EventSettings,
  timeZone: string,
): DateImpact {
  const start = Date.parse(date.start);
  const end = Date.parse(date.end);
  const effects = new Set<Effect>(profile?.effects ?? []);
  if (settings.kind === "single") {
    const endsLate = end >= atHour(start, LATE_FROM_HOUR, timeZone);
    const runsIntoNight =
      !!profile?.runsLate && end >= atHour(start, RUNS_LATE_FROM_HOUR, timeZone);
    if (endsLate || runsIntoNight) effects.add("lateNight");
  }
  return {
    profiled: !!profile,
    effects: EFFECTS.filter((e) => effects.has(e)),
    strain: profile?.strain ?? null,
    recoveryDays: profile?.recoveryDays ?? 0,
    outdoors: profile?.outdoors ?? false,
    daylight: profile?.daylight ?? false,
    start,
    end,
  };
}
