/**
 * Learning from use (#122): what people send when the AI got something wrong,
 * checked before it is stored for the project owner to read. Everything is
 * treated as untrusted: each kind is rebuilt from the parts it may have, cut
 * to its length, and refused if it is not what it says.
 *
 * Kinds:
 * - label: the "Forkert?" correction of an event's label (#112): the title and
 *   the calendar's name as sent to the AI, the label it gave, what the person
 *   wrote, and the label it got from that. Never dates, places or other events.
 * - plan: a plan Planlæg med AI made (#100) as it was sent to the group: what
 *   the person wrote, the settings the AI made of it, which of its guesses the
 *   person changed by hand, and the settings it ended as. A plan sent as it
 *   was counts as right. Never the group or its members.
 */
import { cleanLabel, type EventLabel, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH } from "./labelAi.ts";
import { safeName } from "./categorizeAi.ts";
import { cleanText } from "./text.ts";

export interface LabelCorrectionData {
  title: string;
  /** The calendar's name, with emails and links taken out. */
  calendar: string;
  previous: EventLabel;
  note: string;
  label: EventLabel;
}

/** The scheduler's settings as the AI speaks them (src/lib/aiPlan.ts, PlanSettings); null is "nothing said". */
export interface PlanSettingsData {
  kind: "meeting" | "trip" | "holiday" | null;
  startHour: number | null;
  anyTime: boolean | null;
  durationMinutes: number | null;
  weekdays: number[] | null;
  days: number | null;
  startWeekday: number | null;
  months: { from: string; to: string } | "any" | null;
}

export const PLAN_FIELDS = [
  "kind",
  "startHour",
  "anyTime",
  "durationMinutes",
  "weekdays",
  "days",
  "startWeekday",
  "months",
] as const;
export type PlanField = (typeof PLAN_FIELDS)[number];

export interface PlanFeedbackData {
  /** What the person wrote or said, oldest first. */
  texts: string[];
  /** What the AI made of it. */
  plan: PlanSettingsData & {
    title: string | null;
    place: string | null;
    note: string | null;
    assumed: PlanField[];
  };
  /** The AI's guesses the person changed by hand before sending. */
  overridden: PlanField[];
  /** The settings it was sent with. */
  final: PlanSettingsData;
}

export type Feedback =
  { kind: "label"; data: LabelCorrectionData } | { kind: "plan"; data: PlanFeedbackData };

/** A label correction, or null if it isn't one. */
export function readLabelCorrection(raw: unknown): LabelCorrectionData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = cleanText(r.title, MAX_TITLE_LENGTH);
  const note = cleanText(r.note, MAX_NOTE_LENGTH);
  const previous = cleanLabel(r.previous);
  const label = cleanLabel(r.label);
  if (!title || !note || !previous || !label) return null;
  return {
    title,
    calendar: typeof r.calendar === "string" ? safeName(r.calendar) : "(no name)",
    previous,
    note,
    label,
  };
}

const int = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The settings, each part checked against what it may be; null if any isn't. */
function readPlanSettings(raw: unknown): PlanSettingsData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const orNull = <T>(v: unknown, ok: (x: unknown) => x is T): T | null | undefined =>
    v === null || v === undefined ? null : ok(v) ? v : undefined;

  const kind = orNull(
    r.kind,
    (v): v is "meeting" | "trip" | "holiday" => v === "meeting" || v === "trip" || v === "holiday",
  );
  const startHour = orNull(r.startHour, (v): v is number => int(v, 0, 23));
  const anyTime = orNull(r.anyTime, (v): v is boolean => typeof v === "boolean");
  const durationMinutes = orNull(r.durationMinutes, (v): v is number => int(v, 1, 24 * 60));
  const weekdays = orNull(
    r.weekdays,
    (v): v is number[] => Array.isArray(v) && v.length <= 7 && v.every((d) => int(d, 0, 6)),
  );
  const days = orNull(r.days, (v): v is number => int(v, 1, 31));
  const startWeekday = orNull(r.startWeekday, (v): v is number => int(v, 0, 6));
  const months = orNull(
    r.months,
    (v): v is { from: string; to: string } | "any" =>
      v === "any" ||
      (!!v &&
        typeof v === "object" &&
        MONTH.test(String((v as { from?: unknown }).from)) &&
        MONTH.test(String((v as { to?: unknown }).to))),
  );
  const parts = [kind, startHour, anyTime, durationMinutes, weekdays, days, startWeekday, months];
  if (parts.some((p) => p === undefined)) return null;
  return {
    kind: kind!,
    startHour: startHour!,
    anyTime: anyTime!,
    durationMinutes: durationMinutes!,
    weekdays: weekdays!,
    days: days!,
    startWeekday: startWeekday!,
    months: months === "any" || months === null ? months : { from: months!.from, to: months!.to },
  };
}

/** A list of plan field names, only the ones that exist, each once. */
const planFields = (raw: unknown): PlanField[] =>
  PLAN_FIELDS.filter((f) => Array.isArray(raw) && raw.includes(f));

const MAX_PLAN_TEXT_LENGTH = 600;
const MAX_PLAN_TEXTS = 5;
const MAX_PLAN_LINE_LENGTH = 200;

/** A plan and what became of it, or null if it isn't one. */
export function readPlanFeedback(raw: unknown): PlanFeedbackData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.texts) || r.texts.length === 0 || r.texts.length > MAX_PLAN_TEXTS) {
    return null;
  }
  const texts = r.texts.map((t) => cleanText(t, MAX_PLAN_TEXT_LENGTH));
  if (texts.some((t) => t === null)) return null;
  const plan = readPlanSettings(r.plan);
  const final = readPlanSettings(r.final);
  if (!plan || !final) return null;
  const p = r.plan as Record<string, unknown>;
  return {
    texts: texts as string[],
    plan: {
      ...plan,
      title: cleanText(p.title, MAX_PLAN_LINE_LENGTH),
      place: cleanText(p.place, MAX_PLAN_LINE_LENGTH),
      note: cleanText(p.note, MAX_PLAN_LINE_LENGTH),
      assumed: planFields(p.assumed),
    },
    overridden: planFields(r.overridden),
    final,
  };
}

/** What a request sent, as a Feedback, or null if it isn't a kind we take. */
export function readFeedback(body: Record<string, unknown>): Feedback | null {
  if (body.kind === "label") {
    const data = readLabelCorrection(body.data);
    return data ? { kind: "label", data } : null;
  }
  if (body.kind === "plan") {
    const data = readPlanFeedback(body.data);
    return data ? { kind: "plan", data } : null;
  }
  return null;
}

/** The most a person may send in a day, and in all, so nobody can fill the table. */
export const MAX_FEEDBACK_PER_DAY = 40;
export const MAX_FEEDBACK_IN_ALL = 300;
