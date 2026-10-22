/**
 * Who an event is for (#89), counted for a summary: the Deltagere row in the
 * Planlæg sheet's details and a computer's AI summary.
 */
import type { PeopleChoice } from "@/lib/scheduler";

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
