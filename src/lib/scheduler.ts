/**
 * The scheduling page's settings, turned into a search. Pure, so the rules
 * behind the settings bar (what the Tur / ferie switch means, what an empty
 * name is stored as, how a set of weekdays reads) are tested rather than
 * trusted to the page.
 */
import type { Messages } from "@/i18n/da";
import type { MultiDayResult, SpanConflict } from "@/lib/availability";
import { findEventSlot, type EventSettings, type PeopleSettings } from "@/lib/eventSearch";
import { addDays, startOfMonth } from "@/lib/zone";
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

/**
 * When the event should happen (#74): the months searched, first to last,
 * each the local midnight of its 1st ("December", or "November to January").
 */
export interface Period {
  from: string;
  to: string;
}

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
  /** The months to search; null is any time in the year searched. */
  period: Period | null;
}

/**
 * What a suggestion carries besides its search (#84, #99): where and what to
 * know, how many days everyone has to answer, and how many dates to vote on.
 * The search never looks at them.
 */
export interface EventExtras {
  place: string;
  note: string;
  answerDays: number;
  dateCount: number;
}

export const DEFAULT_EXTRAS: EventExtras = { place: "", note: "", answerDays: 3, dateCount: 5 };
/** Days to answer in: 1 to 7 (the server's limit too). */
export const ANSWER_DAY_VALUES = [1, 2, 3, 4, 5, 6, 7];
/** Dates in a vote: 2 to 5 (CANDIDATE_COUNT is the most). */
export const DATE_COUNT_VALUES = [2, 3, 4, 5];
/** The longest place and note the server keeps (MAX_PLACE_LENGTH, MAX_NOTE_LENGTH). */
export const MAX_PLACE_LENGTH = 100;
export const MAX_NOTE_LENGTH = 500;

/**
 * Who an event is for, as chosen on the scheduling page (#89): each member
 * Med (required, the default), Valgfri (optional) or Ikke med (out), and
 * how many must be able to come (null: everyone required).
 */
export type MemberState = "required" | "optional" | "out";

export interface PeopleChoice {
  states: Record<string, MemberState>;
  atLeast: number | null;
}

export const NO_PEOPLE_CHOICE: PeopleChoice = { states: {}, atLeast: null };

/**
 * The search's people settings from a choice, for `members` (the group's,
 * by profile id) and the kind of event: undefined while everything is at
 * its default (everyone, all required), so ordinary events stay as they
 * were. "At least" is for meetings only, and kept within the number
 * required; asking for all of them is the same as asking for nothing.
 */
export function peopleFromChoice(
  members: string[],
  choice: PeopleChoice,
  meeting: boolean,
): PeopleSettings | undefined {
  const state = (id: string) => choice.states[id] ?? "required";
  const invited = members.filter((id) => state(id) !== "out");
  const optional = invited.filter((id) => state(id) === "optional");
  const required = invited.length - optional.length;
  const atLeast =
    meeting && choice.atLeast !== null && required > 0
      ? Math.min(Math.max(choice.atLeast, 1), required)
      : undefined;
  const people: PeopleSettings = {
    members: invited,
    optional,
    ...(atLeast !== undefined && atLeast < required ? { atLeast } : {}),
  };
  const isDefault =
    invited.length === members.length && optional.length === 0 && people.atLeast === undefined;
  return isDefault ? undefined : people;
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
    period: null,
  };
}

/**
 * The period after a tap on `month` (the local midnight of its 1st) in the
 * month picker: an unpicked month stretches the period to reach it, earlier
 * or later; a tap on either end takes that month off (the only month, and
 * the period is gone: any time); a tap on a month inside starts over with
 * just that one, since the period can't have a gap.
 */
export function pickPeriodMonth(
  period: Period | null,
  month: string,
  timeZone: string,
): Period | null {
  if (!period) return { from: month, to: month };
  const m = Date.parse(month);
  const from = Date.parse(period.from);
  const to = Date.parse(period.to);
  const shift = (iso: string, by: number) =>
    new Date(startOfMonth(Date.parse(iso), timeZone, by)).toISOString();
  if (m < from) return { from: month, to: period.to };
  if (m > to) return { from: period.from, to: month };
  if (m === from && m === to) return null;
  if (m === from) return { from: shift(period.from, 1), to: period.to };
  if (m === to) return { from: period.from, to: shift(period.to, -1) };
  return { from: month, to: month };
}

/**
 * The stretch a search covers for `period`: from today or the period's first
 * month, whichever is later, to the end of its last month, never beyond
 * `limit` (the year every search covers, SEARCH_WINDOW).
 */
export function periodWindow(
  period: Period | null,
  today: string,
  limit: { start: string; end: string },
  timeZone: string,
): { start: string; end: string } {
  if (!period) return { start: today, end: limit.end };
  const start = Math.max(Date.parse(today), Date.parse(period.from));
  const end = Math.min(Date.parse(limit.end), startOfMonth(Date.parse(period.to), timeZone, 1));
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

/**
 * The search the settings describe. With the switch on, a trip that starts
 * on a set weekday is a weekly span (leave after work, home in the evening);
 * one that may start on any day is whole days, a holiday.
 */
export function settingsToSearch(s: SchedulerSettings, people?: PeopleSettings): EventSettings {
  // Who it is for (#89), only when chosen: an ordinary event is stored as before.
  const who = people ? { people } : {};
  if (s.multiDay) {
    if (s.startDow === null) return { kind: "vacation", days: s.days, ...who };
    return {
      kind: "trip",
      shape: {
        anchorDow: s.startDow,
        spanDays: Math.min(s.days, MAX_TRIP_DAYS),
        startHour: TRIP_START_HOUR,
        endHour: TRIP_END_HOUR,
      },
      ...who,
    };
  }
  return {
    kind: "single",
    durationMinutes: s.durationMinutes,
    startHour: s.startHour,
    anyTime: s.anyTime,
    allowedDays: s.dows.length < 7 ? s.dows : undefined,
    ...who,
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
    const { slot, conflicts, absent } = findEventSlot(
      participants,
      search,
      next,
      searchEnd,
      timeZone,
    );
    if (!slot) break;
    out.push({ slot, conflicts, ...(absent ? { absent } : {}) });
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
  /** Who can't come, when enough people was all it needed (#89). */
  absent: { profileId: string; name: string }[];
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
  return { tone, yours, others, accepted, absent: (slot && found?.absent) || [] };
}

/**
 * An answer as one comparable string: its date and what it costs whom. Two
 * answers with the same key show the same thing, so a check after fresh busy
 * times can tell "still this date, on the same terms" from "something moved"
 * (FindDate's suggest, #85).
 */
export function answerKey(answer: MultiDayResult | null): string {
  if (!answer?.slot) return "none";
  return JSON.stringify([
    answer.slot.start,
    answer.slot.end,
    answer.conflicts,
    answer.absent ?? [],
  ]);
}
