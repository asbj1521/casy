/**
 * Planning with AI (#100), the browser's half: the `plan-ai` function's
 * answer (supabase/functions/_shared/planAi.ts, whose types this mirrors)
 * turned into the scheduling page's own settings, and back. The server has
 * already kept every value within the scheduler's limits; this checks once
 * more anyway, since the page's search must never run on something it can't
 * show in its controls.
 *
 * Names the person mentioned come back as written and are matched here,
 * against the group's members: they never leave the browser.
 */
import {
  ALL_DOWS,
  MAX_SPAN_DAYS,
  MAX_TRIP_DAYS,
  type MemberState,
  type PeopleChoice,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { localDate, wallTime } from "@/lib/zone";

export type PlanKind = "meeting" | "trip" | "holiday";

/** The scheduler's settings as the AI speaks them; null is "nothing said". */
export interface PlanSettings {
  kind: PlanKind | null;
  startHour: number | null;
  anyTime: boolean | null;
  durationMinutes: number | null;
  /** 0 = Sunday ... 6 = Saturday. */
  weekdays: number[] | null;
  days: number | null;
  startWeekday: number | null;
  /** "YYYY-MM" months, first to last; "any" clears a period. */
  months: { from: string; to: string } | "any" | null;
}

export type PlanField = keyof PlanSettings;

export interface PlanQuestion {
  question: string;
  options: { label: string; patch: PlanSettings }[];
}

export interface AiPlan extends PlanSettings {
  title: string | null;
  place: string | null;
  note: string | null;
  people: { without: string[]; optional: string[]; required: string[] };
  atLeast: number | null;
  assumed: PlanField[];
  questions: PlanQuestion[];
}

/**
 * Where a first description starts from: whatever the AI leaves unsaid is
 * this, rather than the page's random opening settings. Every day of the
 * week and the whole year, since saying nothing about when means any time.
 */
export const AI_BASE_SETTINGS: SchedulerSettings = {
  multiDay: false,
  startHour: 18,
  durationMinutes: 120,
  dows: [...ALL_DOWS],
  anyTime: false,
  days: 3,
  startDow: 5,
  period: null,
};

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** "2026-12" as the local midnight of its 1st, the way a Period holds it; null if not a month. */
export function monthToIso(month: string, timeZone: string): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  return new Date(wallTime(Number(m[1]), Number(m[2]) - 1, 1, 0, timeZone)).toISOString();
}

/** A Period's month (the local midnight of its 1st) as "2026-12". */
export function isoToMonth(iso: string, timeZone: string): string {
  const d = localDate(Date.parse(iso), timeZone);
  return `${d.year}-${String(d.month + 1).padStart(2, "0")}`;
}

/**
 * `settings` with what `plan` says applied on top; whatever it leaves null
 * stays as it was. Used for a description (on AI_BASE_SETTINGS), for more
 * details (on the page's settings) and for a question's answer (its patch).
 */
export function applyPlan(
  settings: SchedulerSettings,
  plan: PlanSettings,
  timeZone: string,
): SchedulerSettings {
  const next = { ...settings };

  if (plan.kind === "meeting") next.multiDay = false;
  if (plan.kind === "trip") {
    next.multiDay = true;
    next.startDow = next.startDow ?? 5;
  }
  if (plan.kind === "holiday") {
    next.multiDay = true;
    next.startDow = null;
  }
  // A start weekday only means something for a trip, which it makes one.
  if (isInt(plan.startWeekday, 0, 6) && (plan.kind === "trip" || next.multiDay)) {
    next.multiDay = true;
    next.startDow = plan.startWeekday;
  }

  if (isInt(plan.startHour, 0, 23)) {
    next.startHour = plan.startHour;
    next.anyTime = false;
  }
  if (plan.anyTime === true) next.anyTime = true;
  if (plan.anyTime === false) next.anyTime = false;
  if (isInt(plan.durationMinutes, 30, 720) && plan.durationMinutes % 30 === 0) {
    next.durationMinutes = plan.durationMinutes;
  }
  if (Array.isArray(plan.weekdays)) {
    const picked = new Set(plan.weekdays.filter((d) => isInt(d, 0, 6)));
    if (picked.size > 0) next.dows = ALL_DOWS.filter((d) => picked.has(d));
  }

  if (isInt(plan.days, 1, MAX_SPAN_DAYS)) next.days = plan.days;
  // A trip that starts on a set weekday covers a week at most.
  if (next.multiDay && next.startDow !== null) next.days = Math.min(next.days, MAX_TRIP_DAYS);

  if (plan.months === "any") next.period = null;
  else if (plan.months) {
    const from = monthToIso(plan.months.from, timeZone);
    const to = monthToIso(plan.months.to, timeZone);
    if (from && to) next.period = from <= to ? { from, to } : { from: to, to: from };
  }
  return next;
}

/** The page's settings the way the AI speaks them, sent along with more details. */
export function toPlanSettings(s: SchedulerSettings, timeZone: string): PlanSettings {
  const meeting = !s.multiDay;
  return {
    kind: meeting ? "meeting" : s.startDow === null ? "holiday" : "trip",
    startHour: meeting && !s.anyTime ? s.startHour : null,
    anyTime: meeting ? s.anyTime : null,
    durationMinutes: meeting ? s.durationMinutes : null,
    weekdays: meeting && s.dows.length < 7 ? [...s.dows] : null,
    days: meeting ? null : s.days,
    startWeekday: meeting ? null : s.startDow,
    months: s.period
      ? { from: isoToMonth(s.period.from, timeZone), to: isoToMonth(s.period.to, timeZone) }
      : null,
  };
}

/**
 * The settings to mark "guessed" after a description: what the AI says it
 * assumed, and, for a first description, what the kind of event needs that
 * it said nothing about (filled from AI_BASE_SETTINGS). Not the weekdays or
 * months: saying nothing about those means any, which is no guess.
 */
export function guessedFields(plan: AiPlan, first: boolean): PlanField[] {
  const guessed = new Set(plan.assumed);
  if (first) {
    const kind = plan.kind ?? "meeting";
    const needs: PlanField[] =
      kind === "meeting"
        ? plan.anyTime
          ? ["durationMinutes"]
          : ["startHour", "durationMinutes"]
        : kind === "trip"
          ? ["days", "startWeekday"]
          : ["days"];
    for (const field of needs) if (plan[field] === null) guessed.add(field);
  }
  return [...guessed];
}

/**
 * Lowercase, without accents (Søren and Soren alike), spaces squashed. Ø and
 * Æ are letters of their own to Unicode, so they're spelled out first; Å
 * loses its ring like any accent.
 */
function normalName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface NameMatch {
  /** The name as the person wrote it. */
  written: string;
  /** The members it could be, by profile id: one is a match, none or several need asking. */
  candidates: string[];
}

/**
 * Who in the group each written name could be. A whole name matches first
 * ("Anna Berg"), then a first name ("Anna"); never a part of one, so "Ann"
 * isn't Anna. You are left out: you can't leave yourself out or make
 * yourself optional.
 */
export function matchNames(
  written: string[],
  members: { profileId: string; name: string; isYou: boolean }[],
): NameMatch[] {
  const others = members.filter((m) => !m.isYou);
  return written.map((name) => {
    const wanted = normalName(name);
    const whole = others.filter((m) => normalName(m.name) === wanted);
    const first = others.filter((m) => normalName(m.name).split(" ")[0] === wanted);
    const candidates = (whole.length > 0 ? whole : first).map((m) => m.profileId);
    return { written: name, candidates };
  });
}

/**
 * Who the event is for, after a plan: `choice` with each matched name set
 * to what the plan says about them (`resolved`: written name to profile id,
 * for the names matched or picked), and the plan's "at least" when it has one.
 */
export function applyPeople(
  choice: PeopleChoice,
  plan: AiPlan,
  resolved: Record<string, string>,
): PeopleChoice {
  const states = { ...choice.states };
  const set = (names: string[], state: MemberState) => {
    for (const name of names) {
      const id = resolved[name];
      if (id) states[id] = state;
    }
  };
  set(plan.people.required, "required");
  set(plan.people.optional, "optional");
  set(plan.people.without, "out");
  return {
    states,
    atLeast: isInt(plan.atLeast, 1, 20) ? plan.atLeast : choice.atLeast,
  };
}

/** Every name the plan mentions, once, in the order written. */
export function mentionedNames(plan: AiPlan): string[] {
  return [...new Set([...plan.people.without, ...plan.people.optional, ...plan.people.required])];
}
