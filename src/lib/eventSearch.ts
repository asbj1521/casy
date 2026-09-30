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
import type { Participant } from "@/types";

/**
 * The hours "any time" may place a meeting within: not overnight, even for
 * someone who happens to be free then. The longest selectable meeting
 * (12 hours, see DURATION_VALUES in SchedulerSettings.tsx) exactly fills this
 * window, so it never makes a fully-free day unreachable.
 */
export const ANY_TIME_EARLIEST_HOUR = 10;
export const ANY_TIME_LATEST_HOUR = 22;

export type EventSettings =
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
  | { kind: "vacation"; days: number };

/**
 * The best date for `settings` on or after `searchStart`. A single meeting
 * reports what people would skip, if it's worth skipping anything at all
 * (findMeetingSlot); multi-day spans report the work/school the dates would
 * need time off from.
 */
export function findEventSlot(
  participants: Participant[],
  settings: EventSettings,
  searchStart: string,
  searchEnd: string,
  timeZone: string,
): MultiDayResult {
  switch (settings.kind) {
    case "single":
      return findMeetingSlot({
        participants,
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

/** True if `value` is a well-formed EventSettings (for data read back from the server). */
export function isEventSettings(value: unknown): value is EventSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
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
