/**
 * The scheduling page's settings, turned into a search. Pure, so the rules
 * behind the settings bar (what the Tur / ferie switch means, what an empty
 * name is stored as, how a set of weekdays reads) are tested rather than
 * trusted to the page.
 */
import type { Messages } from "@/i18n/da";
import type { MultiDayResult } from "@/lib/availability";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { ALL_DOWS } from "@/lib/weekdays";
import { addDays } from "@/lib/zone";
import type { Participant } from "@/types";

/**
 * When a trip that starts on a set weekday leaves and comes home. 17:00 is
 * "after work" in the demo data (workdays run 09:00 to 17:00), so a normal
 * Friday at the office doesn't show up as a conflict on every weekend; 21:00
 * is "home in time for the week".
 */
export const TRIP_START_HOUR = 17;
export const TRIP_END_HOUR = 21;

/** A trip tied to a weekday covers at most a week (the engine's weekly window). */
export const MAX_TRIP_DAYS = 7;
/** A trip or holiday on any days: 1 to 30 days. */
export const MAX_SPAN_DAYS = 30;

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
  | { kind: "all" }
  | { kind: "weekdays" }
  | { kind: "weekends" }
  | { kind: "list"; dows: number[] };

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
): MultiDayResult[] {
  const out: MultiDayResult[] = [];
  let from = afterStart;
  for (let i = 0; i < count; i++) {
    const next = new Date(addDays(Date.parse(from), 1, timeZone)).toISOString();
    const found = findEventSlot(participants, search, next, searchEnd, timeZone);
    if (!found.slot) break;
    out.push(found);
    from = found.slot.start;
  }
  return out;
}
