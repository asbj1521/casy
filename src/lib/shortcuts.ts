/**
 * Genveje (#175): plans saved to run again with one tap. What is kept is the
 * Planlæg sheet's own plan (usePlanning): the name, the search's settings,
 * up to three times to look at, and the extras. Not the months (a saved
 * month would soon be past: a genvej always looks from today), nor the
 * group or who in it is coming (a genvej runs with whichever group is
 * chosen, so one serves them all).
 *
 * A time is only when the meeting starts and how freely (`startHour`, the
 * start window around it, or any time of day); everything else, the length
 * included, is the genvej's own and the same for every time.
 *
 * The plan comes back from the server as it was sent, so it is read here
 * strictly: anything missing or of the wrong kind takes the default, and a
 * plan that isn't one at all reads as null, never as a broken search.
 */
import { formatClockMinutes } from "@/lib/format";
import { DEFAULT_EXTRAS, type EventExtras, type SchedulerSettings } from "@/lib/scheduler";

/** The most genveje a person keeps (the server's limit too). */
export const MAX_SHORTCUTS = 9;
export const MAX_SHORTCUT_NAME = 40;
/** The most times one genvej looks at. */
export const MAX_TIMES = 3;

/** One time a genvej looks at. */
export type ShortcutTime = Pick<SchedulerSettings, "startHour" | "startWindow" | "anyTime">;

/** A genvej's plan, as kept on the server. */
export interface ShortcutPlan {
  v: 1;
  /** The plan's settings less the months, its first time in them. */
  settings: Omit<SchedulerSettings, "period">;
  /** Every time it looks at, 1 to MAX_TIMES, the first the settings' own. */
  times: ShortcutTime[];
  extras: EventExtras;
}

export interface Shortcut {
  id: string;
  /** Its name, which is also the name of the event it plans. */
  name: string;
  plan: ShortcutPlan;
  updatedAt: string;
}

/** A time as a genvej says it: its start to its end ("17:00-19:00"), or the whole day. */
export function timeLabel(time: ShortcutTime, durationMinutes: number, allDay: string): string {
  if (time.anyTime) return allDay;
  const start = time.startHour * 60;
  const clock = (minutes: number) => formatClockMinutes(minutes % (24 * 60));
  return `${clock(start)}-${clock(start + durationMinutes)}`;
}

/** The time a plan's settings hold. */
export function timeOf(settings: ShortcutTime): ShortcutTime {
  return {
    startHour: settings.startHour,
    startWindow: settings.startWindow ? { ...settings.startWindow } : null,
    anyTime: settings.anyTime,
  };
}

/** What a plan in the Planlæg sheet keeps as a genvej, with its times (the first the settings' own). */
export function shortcutPlan(
  settings: SchedulerSettings,
  extras: EventExtras,
  times: ShortcutTime[] = [timeOf(settings)],
): ShortcutPlan {
  const kept: Partial<SchedulerSettings> = { ...settings, ...timeOf(times[0]) };
  delete kept.period;
  return {
    v: 1,
    settings: kept as ShortcutPlan["settings"],
    times: times.slice(0, MAX_TIMES).map(timeOf),
    extras,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;

function readWindow(raw: unknown): SchedulerSettings["startWindow"] {
  return isObject(raw) &&
    typeof raw.from === "number" &&
    typeof raw.to === "number" &&
    raw.from >= 0 &&
    raw.to <= 24 * 60 &&
    raw.from < raw.to
    ? { from: raw.from, to: raw.to }
    : null;
}

function readTime(raw: unknown, base: ShortcutTime): ShortcutTime | null {
  if (!isObject(raw)) return null;
  return {
    startHour: num(raw.startHour, 0, 23.75, base.startHour),
    startWindow: readWindow(raw.startWindow),
    anyTime: typeof raw.anyTime === "boolean" ? raw.anyTime : base.anyTime,
  };
}

/**
 * A plan as the server handed it back, every field checked, with `base` (a
 * whole set of settings) for what is missing. Null when it isn't a plan.
 */
export function readShortcutPlan(raw: unknown, base: SchedulerSettings): ShortcutPlan | null {
  if (!isObject(raw) || raw.v !== 1 || !isObject(raw.settings)) return null;
  const s = raw.settings;
  const dows = Array.isArray(s.dows)
    ? s.dows.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : base.dows;
  const first = readTime(s, base) ?? timeOf(base);
  const settings: ShortcutPlan["settings"] = {
    multiDay: typeof s.multiDay === "boolean" ? s.multiDay : base.multiDay,
    ...first,
    durationMinutes: num(s.durationMinutes, 15, 24 * 60, base.durationMinutes),
    dows: dows.length > 0 ? [...new Set(dows)] : base.dows,
    days: num(s.days, 1, 30, base.days),
    startDow: s.startDow === null ? null : num(s.startDow, 0, 6, base.startDow ?? 5),
  };
  const more = Array.isArray(raw.times)
    ? raw.times.slice(1, MAX_TIMES).flatMap((t) => readTime(t, first) ?? [])
    : [];

  const e = isObject(raw.extras) ? raw.extras : {};
  const answerDays = e.answerDays;
  const extras: EventExtras = {
    place: typeof e.place === "string" ? e.place : DEFAULT_EXTRAS.place,
    note: typeof e.note === "string" ? e.note : DEFAULT_EXTRAS.note,
    answerDays:
      typeof answerDays === "number" &&
      Number.isInteger(answerDays) &&
      answerDays >= 1 &&
      answerDays <= 7
        ? answerDays
        : null,
    dateCount: num(e.dateCount, 2, 5, DEFAULT_EXTRAS.dateCount),
  };
  return { v: 1, settings, times: [first, ...more], extras };
}
