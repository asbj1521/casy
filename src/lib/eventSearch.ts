/**
 * One search, described as data: what kind of event, and its shape.
 *
 * The scheduling page runs it whenever its settings change, and a
 * suggested event keeps the same settings so that when someone declines a
 * date, their browser can run the exact same search again from the day after.
 * Keeping both on this one function is what stops the replacement date from
 * being found by slightly different rules than the first one was.
 */
import {
  findBestDaySpan,
  findMeetingSlot,
  findWeeklySpan,
  type MultiDayResult,
  type WeeklySpanShape,
} from "@/lib/availability";
import { APP_TIME_ZONE, startOfMonth } from "@/lib/zone";
import type { Participant } from "@/types";

/**
 * Where every search looks: from the 1st of this month through twelve whole
 * months, in APP_TIME_ZONE. Group calendars are fetched for exactly this
 * range (the server keeps a week back to a year ahead, syncWindow.ts), and
 * the example groups are generated for the same months.
 */
const THIS_MONTH = startOfMonth(Date.now(), APP_TIME_ZONE);
export const SEARCH_WINDOW = {
  start: new Date(THIS_MONTH).toISOString(),
  end: new Date(startOfMonth(THIS_MONTH, APP_TIME_ZONE, 12)).toISOString(),
};

/**
 * The hours "any time" may place a meeting within: not overnight, even for
 * someone who happens to be free then. The longest selectable meeting
 * (12 hours, see DURATION_VALUES in SchedulerSettings.tsx) exactly fills this
 * window, so it never makes a fully-free day unreachable.
 */
export const ANY_TIME_EARLIEST_HOUR = 10;
export const ANY_TIME_LATEST_HOUR = 22;

/**
 * Who an event is for (#89), when not simply everyone in the group, each as
 * a profile id. Everyone in `members` is invited; those also in `optional`
 * are invited and shown, but their calendars never block a date and their
 * "no" never decides a vote. `atLeast` (meetings only) is enough: a date
 * works once that many of the required members (members not optional) can
 * come. Members with no calendar in Casy count as able: they answer by hand.
 */
export interface PeopleSettings {
  members: string[];
  optional: string[];
  atLeast?: number;
}

export type EventSettings = (
  | {
      kind: "single";
      durationMinutes: number;
      startHour: number;
      /**
       * Ignore startHour and search the day's 10:00-22:00 window for a free
       * stretch this long, wherever it falls, instead of a fixed time
       * everyone must be free at.
       */
      anyTime?: boolean;
      /** Local days of week to search (0 = Sun … 6 = Sat); omitted = every day. */
      allowedDays?: number[];
    }
  | { kind: "trip"; shape: WeeklySpanShape }
  | { kind: "vacation"; days: number }
) & {
  /** Omitted: everyone in the group, all required. */
  people?: PeopleSettings;
};

/**
 * Who a search looks at, and how many of them are enough: the required
 * members among `participants` (the group's members with a calendar), and
 * the quorum among those. Members with no calendar are not in
 * `participants`; a required one counts as able, so the quorum asked of the
 * others shrinks by one for each. No quorum (undefined): everyone searched
 * must be free, as before.
 */
export function peopleForSearch(
  participants: Participant[],
  people: PeopleSettings | undefined,
): { searched: Participant[]; quorum: number | undefined } {
  if (!people) return { searched: participants, quorum: undefined };
  const optional = new Set(people.optional);
  const required = people.members.filter((id) => !optional.has(id));
  const requiredSet = new Set(required);
  const searched = participants.filter((p) => requiredSet.has(p.profileId));
  if (people.atLeast === undefined) return { searched, quorum: undefined };
  const withoutCalendar = required.filter((id) => !searched.some((p) => p.profileId === id)).length;
  const quorum = Math.max(0, people.atLeast - withoutCalendar);
  return { searched, quorum: quorum >= searched.length ? undefined : quorum };
}

/**
 * The best date for `settings` on or after `searchStart`. A single meeting
 * reports what people would skip, if it's worth skipping anything at all
 * (findMeetingSlot); multi-day spans report the work/school the dates would
 * need time off from.
 */
export function findEventSlot(
  allParticipants: Participant[],
  settings: EventSettings,
  searchStart: string,
  searchEnd: string,
  timeZone: string,
): MultiDayResult {
  // Only the required members are searched; "at least N" is for meetings.
  const { searched: participants, quorum } = peopleForSearch(allParticipants, settings.people);
  switch (settings.kind) {
    case "single":
      return findMeetingSlot({
        participants,
        quorum,
        durationMinutes: settings.durationMinutes,
        searchStart,
        searchEnd,
        timeZone,
        constraints: settings.anyTime
          ? // Nobody cares what time it starts, but not the middle of the
            // night: the allowed window is 10:00-22:00, and the engine finds
            // the earliest free stretch long enough within it.
            {
              earliestHour: ANY_TIME_EARLIEST_HOUR,
              latestHour: ANY_TIME_LATEST_HOUR,
              allowedDays: settings.allowedDays,
            }
          : {
              // A fixed meeting time: the allowed window is exactly one
              // meeting long, so only days the whole group is free at that
              // hour qualify. Not capped at 24, so a night out can run past
              // midnight.
              earliestHour: settings.startHour,
              latestHour: settings.startHour + settings.durationMinutes / 60,
              allowedDays: settings.allowedDays,
            },
      });
    case "trip":
      return findWeeklySpan(participants, settings.shape, searchStart, searchEnd, timeZone);
    case "vacation":
      return findBestDaySpan(participants, settings.days, searchStart, searchEnd, timeZone);
  }
}

const isInt = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * True if `value` is a well-formed PeopleSettings: 1 to 20 distinct members,
 * the optional ones among them, and "at least" between 1 and the number
 * required (meetings only). Mirrored by the server (_shared/events.ts).
 */
export function isPeopleSettings(value: unknown, kind: unknown): value is PeopleSettings {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  const ids = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64);
  if (!ids(p.members) || !ids(p.optional)) return false;
  const members = new Set(p.members);
  if (members.size !== p.members.length || members.size < 1 || members.size > 20) return false;
  if (new Set(p.optional).size !== p.optional.length) return false;
  if (!p.optional.every((id) => members.has(id))) return false;
  if (p.atLeast === undefined) return true;
  const required = members.size - p.optional.length;
  return kind === "single" && isInt(p.atLeast, 1, required);
}

/** True if `value` is a well-formed EventSettings (for data read back from the server). */
export function isEventSettings(value: unknown): value is EventSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  if (s.people !== undefined && !isPeopleSettings(s.people, s.kind)) return false;
  const int = isInt;
  switch (s.kind) {
    case "single":
      return (
        int(s.durationMinutes, 1, 24 * 60) &&
        int(s.startHour, 0, 23) &&
        (s.anyTime === undefined || typeof s.anyTime === "boolean") &&
        (s.allowedDays === undefined ||
          (Array.isArray(s.allowedDays) && s.allowedDays.every((d) => int(d, 0, 6))))
      );
    case "trip": {
      const shape = s.shape as Record<string, unknown> | undefined;
      return (
        !!shape &&
        int(shape.anchorDow, 0, 6) &&
        int(shape.spanDays, 1, 7) &&
        int(shape.startHour, 0, 23) &&
        int(shape.endHour, 0, 24)
      );
    }
    case "vacation":
      return int(s.days, 1, 30);
    default:
      return false;
  }
}
