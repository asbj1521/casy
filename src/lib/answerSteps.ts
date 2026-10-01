/**
 * The dates stepped through on the scheduling page, as plain data.
 *
 * The first step is the first date from today (`from: null`); each later one
 * is where a step forward, or a day picked in the chart, searched from.
 * `index` is the step on screen, and going back only replays: it never
 * searches. Changing a setting or the group starts over from today.
 *
 * `accepted` is the start of a date whose time off you have signed off (a
 * trip or holiday that clashes with your own work or school). It belongs to
 * the date on screen, so every move clears it.
 */
export interface AnswerSteps {
  steps: Step[];
  index: number;
  accepted: string | null;
}

export interface Step {
  /** Where the search starts (a local-midnight ISO), or null for today. */
  from: string | null;
  /**
   * A meeting day picked on purpose (the chart, a later date): that very day
   * is shown if it works at all, even by someone skipping something.
   */
  day?: boolean;
}

/** Start over from `from`, today unless given. */
export function restart(from: string | null = null): AnswerSteps {
  return { steps: [{ from }], index: 0, accepted: null };
}

/** The step on screen. */
export function currentStep(s: AnswerSteps): Step {
  return s.steps[s.index] ?? { from: null };
}

/**
 * Show the first date from `from`. Steps ahead of the one on screen (left by
 * stepping back) are dropped; the way back is kept.
 */
export function jump(s: AnswerSteps, from: string, day = false): AnswerSteps {
  return {
    steps: [...s.steps.slice(0, s.index + 1), { from, day }],
    index: s.index + 1,
    accepted: null,
  };
}

/**
 * Step forward: to the date that was there before stepping back, if there
 * was one, so going back and forth always shows the same dates; otherwise
 * search on from `from` (the day after the date on screen).
 */
export function forward(s: AnswerSteps, from: string): AnswerSteps {
  return s.index + 1 < s.steps.length
    ? { ...s, index: s.index + 1, accepted: null }
    : jump(s, from);
}

/** Step back to the date shown before this one. */
export function back(s: AnswerSteps): AnswerSteps {
  return s.index > 0 ? { ...s, index: s.index - 1, accepted: null } : s;
}

/** Sign off the time off the date starting at `slotStart` costs you. */
export function accept(s: AnswerSteps, slotStart: string): AnswerSteps {
  return { ...s, accepted: slotStart };
}
