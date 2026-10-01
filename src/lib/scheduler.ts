/**
 * The scheduling page's settings, turned into a search. Pure, so the rules
 * behind the settings bar (what the Tur / ferie switch means, what an empty
 * name is stored as, how a set of weekdays reads) are tested rather than
 * trusted to the page.
 */
import type { Messages } from "@/i18n/da";
import type { MultiDayResult, SpanConflict } from "@/lib/availability";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { addDays } from "@/lib/zone";
import type { Participant, TimeSlot } from "@/types";

/**
 * When a trip that starts on a set weekday leaves and comes home. 17:00 is
 * "after work" in the demo data (workdays run 09:00 to 17:00), so a normal
 * Friday at the office doesn't show up as a conflict on every weekend; 21:00
 * is "home in time for the week".
 */
const TRIP_START_HOUR = 17;
const TRIP_END_HOUR = 21;

/** A trip tied to a weekday covers at most a week (the engine's weekly window). */
export const MAX_TRIP_DAYS = 7;
/** A trip or holiday on any days: 1 to 30 days. */
export const MAX_SPAN_DAYS = 30;

/**
 * Every day of the week in display order, Monday first, as local day-of-week
 * values (0 = Sunday ... 6 = Saturday), as the engine's `allowedDays` and
 * `WeeklySpanShape.anchorDow` take them.
 */
export const ALL_DOWS = [1, 2, 3, 4, 5, 6, 0];

/** Everything the settings bar holds, in both modes. */
export interface SchedulerSettings {
  /** False: one meeting on a day. True: the Tur / ferie switch, whole days. */
  multiDay: boolean;
  /** One meeting: local start hour, length, and which weekdays are searched. */
  startHour: number;
  durationMinutes: number;
  dows: number[];
  /** One meeting: ignore startHour, search the whole day for a free window this long. */
  anyTime: boolean;
  /** Tur / ferie: how many days, and the weekday it starts on (null = any day). */
  days: number;
  startDow: number | null;
}

/** A meeting the page may open on: start hour and length. */
type MeetingPreset = Pick<SchedulerSettings, "startHour" | "durationMinutes">;

/**
 * Realistic starting points, one picked per page load so the first answer
 * varies between visits. Curated rather than random per field, which would
 * open on things like 03:00 for 11 hours. Weekdays stay all seven: a chart
 * with a bar on every day reads far better than one or two bars a week.
 */
export const DEFAULT_PRESETS: readonly MeetingPreset[] = [
  { startHour: 18, durationMinutes: 180 },
  { startHour: 19, durationMinutes: 120 },
  { startHour: 12, durationMinutes: 60 },
  { startHour: 10, durationMinutes: 120 },
  { startHour: 14, durationMinutes: 180 },
  { startHour: 17, durationMinutes: 120 },
];

/** What the page opens on: a random preset meeting; a weekend trip if switched. */
export function randomDefaultSettings(random: () => number = Math.random): SchedulerSettings {
  const preset = DEFAULT_PRESETS[Math.floor(random() * DEFAULT_PRESETS.length)];
  return {
    multiDay: false,
    ...preset,
    dows: [...ALL_DOWS],
    anyTime: false,
    days: 3,
    startDow: 5,
  };
}

/**
 * The search the settings describe. With the switch on, a trip that starts
 * on a set weekday is a weekly span (leave after work, home in the evening);
 * one that may start on any day is whole days, a holiday.
 */
export function settingsToSearch(s: SchedulerSettings): EventSettings {
  if (s.multiDay) {
    if (s.startDow === null) return { kind: "vacation", days: s.days };
    return {
      kind: "trip",
      shape: {
        anchorDow: s.startDow,
        spanDays: Math.min(s.days, MAX_TRIP_DAYS),
        startHour: TRIP_START_HOUR,
        endHour: TRIP_END_HOUR,
      },
    };
  }
  return {
    kind: "single",
    durationMinutes: s.durationMinutes,
    startHour: s.startHour,
    anyTime: s.anyTime,
    allowedDays: s.dows.length < 7 ? s.dows : undefined,
  };
}

/**
 * The event type whose name stands in for a name left empty. Stored names of
 * event types are translated for each reader (src/i18n/eventTitle.ts), so the
 * group still reads something sensible in their own language.
 */
export function fallbackTitleId(search: EventSettings): keyof Messages["eventTypes"] {
  if (search.kind === "vacation") return "vacation";
  if (search.kind === "trip") return "weekend";
  if (search.anyTime) return "meeting";
  return search.startHour < 16 ? "lunch" : "evening";
}

/** How a set of searched weekdays reads: every day, weekdays, weekends, or a list. */
export type DayListLabel =
  { kind: "all" } | { kind: "weekdays" } | { kind: "weekends" } | { kind: "list"; dows: number[] };

export function describeDays(dows: number[]): DayListLabel {
  const set = new Set(dows);
  if (set.size === 7) return { kind: "all" };
  const same = (want: number[]) => set.size === want.length && want.every((d) => set.has(d));
  if (same([1, 2, 3, 4, 5])) return { kind: "weekdays" };
  if (same([6, 0])) return { kind: "weekends" };
  return { kind: "list", dows: ALL_DOWS.filter((d) => set.has(d)) };
}

/**
 * Whole days from `todayIso` to `dayIso` (both local midnights). Rounded, so
 * a clock change in between (a 23 or 25 hour day) doesn't shave one off.
 */
export function daysUntil(dayIso: string, todayIso: string): number {
  return Math.round((Date.parse(dayIso) - Date.parse(todayIso)) / 86_400_000);
}

/** A date a search found, and what it costs whom. */
export type FoundDate = MultiDayResult & { slot: TimeSlot };

/**
 * The next `count` dates after `afterStart`, each found by the same search
 * from the day after the one before: the "Også muligt" row under the answer.
 */
export function laterSlots(
  participants: Participant[],
  search: EventSettings,
  afterStart: string,
  count: number,
  searchEnd: string,
  timeZone: string,
): FoundDate[] {
  const out: FoundDate[] = [];
  let from = afterStart;
  for (let i = 0; i < count; i++) {
    const next = new Date(addDays(Date.parse(from), 1, timeZone)).toISOString();
    const { slot, conflicts } = findEventSlot(participants, search, next, searchEnd, timeZone);
    if (!slot) break;
    out.push({ slot, conflicts });
    from = slot.start;
  }
  return out;
}

/**
 * How the answer on screen stands, which decides its colour and what it says:
 *
 * - `clean`: everyone can, as things are.
 * - `skip`: a meeting only works if someone skips something they marked
 *   skippable.
 * - `approve`: a trip or holiday costs you time off from work or school, which
 *   you sign off before it can go to the group.
 * - `review`: it costs others time off, so they will be asked.
 * - `none`: no date at all.
 */
export type AnswerTone = "clean" | "skip" | "approve" | "review" | "none";

export interface AnswerReview {
  tone: AnswerTone;
  /** What it costs you: time off for a trip or holiday, a skip for a meeting. */
  yours: SpanConflict | null;
  /** What it costs everyone else, the same way. */
  others: SpanConflict[];
  /** You have signed off your time off for this date. */
  accepted: boolean;
}

export function reviewAnswer(
  found: MultiDayResult | null,
  search: EventSettings,
  youProfileId: string | null,
  acceptedStart: string | null,
): AnswerReview {
  const slot = found?.slot ?? null;
  const conflicts = found?.slot ? found.conflicts : [];
  const yours = conflicts.find((c) => c.profileId === youProfileId) ?? null;
  const others = conflicts.filter((c) => c.profileId !== youProfileId);
  const accepted = !!slot && acceptedStart === slot.start;
  const tone: AnswerTone = !slot
    ? "none"
    : search.kind === "single"
      ? conflicts.length > 0
        ? "skip"
        : "clean"
      : yours && !accepted
        ? "approve"
        : others.length > 0
          ? "review"
          : "clean";
  return { tone, yours, others, accepted };
}
