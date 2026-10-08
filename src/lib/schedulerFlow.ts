/**
 * The phone's scheduling flow (#101): the scheduling page split into four
 * steps, one screen each, in the order a plan is made. Which step is on
 * screen lives in the address (`?step=`), so the phone's back button and the
 * iPhone's back swipe go one step back.
 */
import type { EventExtras, PeopleChoice } from "@/lib/scheduler";

export const FLOW_STEPS = ["group", "what", "details", "dates"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

/**
 * The step a page address asks for. None (or an unknown one) is the first
 * step; the older `?settings` (Flere indstillinger, #98) opens the details.
 */
export function stepFromSearch(search: string): FlowStep {
  const params = new URLSearchParams(search);
  const step = params.get("step");
  if (step && (FLOW_STEPS as readonly string[]).includes(step)) return step as FlowStep;
  return params.has("settings") ? "details" : "group";
}

/** The address part for `step`: the first step is the page's plain address. */
export function searchForStep(step: FlowStep): string {
  return step === "group" ? "" : `?step=${step}`;
}

/** The step after `step`, or null after the last. */
export function nextStep(step: FlowStep): FlowStep | null {
  return FLOW_STEPS[FLOW_STEPS.indexOf(step) + 1] ?? null;
}

/** The step before `step`, or null before the first. */
export function previousStep(step: FlowStep): FlowStep | null {
  return FLOW_STEPS[FLOW_STEPS.indexOf(step) - 1] ?? null;
}

/** Who an event is for, counted, for the details step's Deltagere row. */
export interface PeopleSummary {
  total: number;
  required: number;
  optional: number;
  /** "At least N", where it applies (a meeting, with 2 or more required). */
  atLeast: number | null;
  /** Everyone required, and all of them must be able: the default. */
  everyone: boolean;
}

/**
 * `choice` counted over `memberIds`, by the same rules as the Deltagere
 * settings (ParticipantSettings): a member with no state is required, and
 * "at least" only counts for a meeting with two or more required, kept
 * within how many are.
 */
export function summarizePeople(
  memberIds: string[],
  choice: PeopleChoice,
  meeting: boolean,
): PeopleSummary {
  const states = memberIds.map((id) => choice.states[id] ?? "required");
  const required = states.filter((s) => s === "required").length;
  const optional = states.filter((s) => s === "optional").length;
  const atLeast =
    meeting && required >= 2 && choice.atLeast !== null ? Math.min(choice.atLeast, required) : null;
  return {
    total: memberIds.length,
    required,
    optional,
    atLeast,
    everyone: required === memberIds.length && atLeast === null,
  };
}

/**
 * Whether anything on the optional details step (the people, the place and
 * the note) differs from how it starts: its button then reads "See dates"
 * rather than "Skip". The vote's settings are on the dates step.
 */
export function detailsTouched(extras: EventExtras, people: PeopleChoice): boolean {
  return (
    extras.place.trim() !== "" ||
    extras.note.trim() !== "" ||
    people.atLeast !== null ||
    Object.values(people.states).some((state) => state !== "required")
  );
}
