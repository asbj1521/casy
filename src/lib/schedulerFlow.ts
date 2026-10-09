/**
 * The phone's scheduling flow (#101): the scheduling page split into four
 * steps, one screen each, in the order a plan is made. Which step is on
 * screen lives in the address (`?step=`), so the phone's back button and the
 * iPhone's back swipe go one step back.
 */
import type { EventExtras, PeopleChoice } from "@/lib/scheduler";

export const FLOW_STEPS = ["group", "what", "details", "dates"] as const;
/**
 * Planning with AI (#100), a flow of its own opened from the first step: the
 * event described in words, the group picked on the same screen (and the
 * settings it gives adjusted there too), then the dates.
 */
export const AI_FLOW_STEPS = ["describe", "dates"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number] | (typeof AI_FLOW_STEPS)[number];

/** The steps of the flow, with AI or without. */
export function flowSteps(ai: boolean): readonly FlowStep[] {
  return ai ? AI_FLOW_STEPS : FLOW_STEPS;
}

/**
 * The step a page address asks for. None (or an unknown one) is the first
 * step; the older `?settings` (Flere indstillinger, #98) opens the details.
 */
export function stepFromSearch(search: string): FlowStep {
  const params = new URLSearchParams(search);
  const step = params.get("step");
  if (step && ([...FLOW_STEPS, ...AI_FLOW_STEPS] as string[]).includes(step)) {
    return step as FlowStep;
  }
  return params.has("settings") ? "details" : "group";
}

/** Whether the address is in the AI flow: its own step, or `ai` beside a shared one. */
export function aiFromSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("step") === "describe" || params.has("ai");
}

/** The address part for `step`: the first step is the page's plain address. */
export function searchForStep(step: FlowStep, ai = false): string {
  if (step === "group") return "";
  return `?step=${step}${ai && step !== "describe" ? "&ai" : ""}`;
}

/** The step after `step`, or null after the last. */
export function nextStep(step: FlowStep, ai = false): FlowStep | null {
  const steps = flowSteps(ai);
  return steps[steps.indexOf(step) + 1] ?? null;
}

/**
 * The step before `step`, or null before the first. The AI flow's first
 * step goes back to where it was opened from, the normal flow's first.
 */
export function previousStep(step: FlowStep, ai = false): FlowStep | null {
  const steps = flowSteps(ai);
  return steps[steps.indexOf(step) - 1] ?? (ai && step === "describe" ? "group" : null);
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
