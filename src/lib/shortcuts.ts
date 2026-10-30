/**
 * Genveje (#175): plans saved to run again with one tap. What is kept is the
 * Planlæg sheet's own plan (usePlanning): the name, the search's settings
 * less the months (a saved month would soon be past, so a genvej always
 * looks from today), the extras and who is coming. The group is kept beside
 * it, by id, on the server (plan-presets).
 *
 * The plan comes back from the server as it was sent, so it is read here
 * strictly: anything missing or of the wrong kind takes the default, and a
 * plan that isn't one at all reads as null, never as a broken search.
 */
import {
  DEFAULT_EXTRAS,
  type EventExtras,
  type MemberState,
  type PeopleChoice,
  type SchedulerSettings,
} from "@/lib/scheduler";

/** The most genveje a person keeps (the server's limit too). */
export const MAX_SHORTCUTS = 9;
export const MAX_SHORTCUT_NAME = 40;

/** A genvej's plan, as kept on the server. */
export interface ShortcutPlan {
  v: 1;
  settings: Omit<SchedulerSettings, "period">;
  extras: EventExtras;
  people: PeopleChoice;
}

export interface Shortcut {
  id: string;
  /** Its name, which is also the name of the event it plans. */
  name: string;
  /** Null once its group is gone: one is picked before it runs. */
  groupId: string | null;
  plan: ShortcutPlan;
  updatedAt: string;
}

/** What a plan in the Planlæg sheet keeps as a genvej. */
export function shortcutPlan(
  settings: SchedulerSettings,
  extras: EventExtras,
  people: PeopleChoice,
): ShortcutPlan {
  const kept: Partial<SchedulerSettings> = { ...settings };
  delete kept.period;
  return { v: 1, settings: kept as ShortcutPlan["settings"], extras, people };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
const STATES: MemberState[] = ["required", "optional", "out"];

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
  const window =
    isObject(s.startWindow) &&
    typeof s.startWindow.from === "number" &&
    typeof s.startWindow.to === "number" &&
    s.startWindow.from >= 0 &&
    s.startWindow.to <= 24 * 60 &&
    s.startWindow.from < s.startWindow.to
      ? { from: s.startWindow.from, to: s.startWindow.to }
      : null;
  const settings: ShortcutPlan["settings"] = {
    multiDay: typeof s.multiDay === "boolean" ? s.multiDay : base.multiDay,
    startHour: num(s.startHour, 0, 23.75, base.startHour),
    durationMinutes: num(s.durationMinutes, 15, 24 * 60, base.durationMinutes),
    dows: dows.length > 0 ? [...new Set(dows)] : base.dows,
    anyTime: typeof s.anyTime === "boolean" ? s.anyTime : base.anyTime,
    startWindow: window,
    days: num(s.days, 1, 30, base.days),
    startDow: s.startDow === null ? null : num(s.startDow, 0, 6, base.startDow ?? 5),
  };

  const e = isObject(raw.extras) ? raw.extras : {};
  const extras: EventExtras = {
    place: typeof e.place === "string" ? e.place : DEFAULT_EXTRAS.place,
    note: typeof e.note === "string" ? e.note : DEFAULT_EXTRAS.note,
    answerDays:
      Number.isInteger(e.answerDays) &&
      (e.answerDays as number) >= 1 &&
      (e.answerDays as number) <= 7
        ? (e.answerDays as number)
        : null,
    dateCount: num(e.dateCount, 2, 5, DEFAULT_EXTRAS.dateCount),
  };

  const p = isObject(raw.people) ? raw.people : {};
  const states: Record<string, MemberState> = {};
  if (isObject(p.states)) {
    for (const [id, state] of Object.entries(p.states)) {
      if (STATES.includes(state as MemberState)) states[id] = state as MemberState;
    }
  }
  const atLeast = typeof p.atLeast === "number" && p.atLeast >= 1 ? Math.floor(p.atLeast) : null;
  return { v: 1, settings, extras, people: { states, atLeast } };
}
