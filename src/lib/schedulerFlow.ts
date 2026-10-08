/**
 * The phone's scheduling flow (#101): the scheduling page split into four
 * steps, one screen each, in the order a plan is made. Which step is on
 * screen lives in the address (`?step=`), so the phone's back button and the
 * iPhone's back swipe go one step back.
 */
import { DEFAULT_EXTRAS, type EventExtras, type PeopleChoice } from "@/lib/scheduler";

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

/**
 * Whether anything on the optional details step differs from how it starts:
 * its button then reads "See dates" rather than "Skip".
 */
export function detailsTouched(extras: EventExtras, people: PeopleChoice): boolean {
  return (
    extras.place.trim() !== "" ||
    extras.note.trim() !== "" ||
    extras.answerDays !== DEFAULT_EXTRAS.answerDays ||
    extras.dateCount !== DEFAULT_EXTRAS.dateCount ||
    people.atLeast !== null ||
    Object.values(people.states).some((state) => state !== "required")
  );
}
