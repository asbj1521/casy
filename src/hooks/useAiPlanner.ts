/**
 * Planning with AI (#100) on the scheduling page: one conversation with the
 * `plan-ai` function, kept by the page (FindDate) so it survives moving
 * between the flow's steps. A description fills the page's settings, name,
 * place, note and people; more details change only what they mention; a
 * question's option is applied here, with no further call; a name that
 * matches nobody, or several people, becomes a question of its own, answered
 * from the group's members (names never leave the browser).
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { planWithAi } from "@/api/planAi";
import {
  AI_BASE_SETTINGS,
  applyPeople,
  applyPlan,
  guessedFields,
  matchNames,
  mentionedNames,
  statedFields,
  toPlanSettings,
  type AiPlan,
  type PlanField,
  type PlanQuestion,
} from "@/lib/aiPlan";
import {
  NO_PEOPLE_CHOICE,
  type EventExtras,
  type MemberState,
  type PeopleChoice,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { APP_TIME_ZONE } from "@/lib/zone";

/** What the server takes as earlier descriptions, at most (MAX_EARLIER). */
const MAX_EARLIER = 4;

export interface NameQuestion {
  /** The name as written. */
  written: string;
  /** What the plan said about them. */
  state: MemberState;
  /** Who it could be: none (anyone in the group may be picked) or several. */
  candidates: string[];
  /** The member picked, or "none"; null while unanswered. */
  picked: string | null;
}

export interface AiSession {
  /** What the person has written, oldest first. */
  texts: string[];
  /** The latest answer, or null before the first. */
  plan: AiPlan | null;
  /** Settings Casy guessed, marked until the person changes them. */
  guessed: PlanField[];
  questions: { question: PlanQuestion; picked: number | null }[];
  names: NameQuestion[];
  /** AI answers left today, for everyone together. */
  left: number | null;
}

const FRESH: AiSession = {
  texts: [],
  plan: null,
  guessed: [],
  questions: [],
  names: [],
  left: null,
};

/** The page's state the planner reads, and how it changes it. */
export interface AiPlannerPage {
  settings: SchedulerSettings;
  name: string;
  members: { profileId: string; name: string; isYou: boolean }[];
  peopleChoice: PeopleChoice;
  setSettings: (settings: SchedulerSettings) => void;
  setName: (name: string) => void;
  setExtras: (patch: Partial<EventExtras>) => void;
  setPeople: (choice: PeopleChoice) => void;
}

export function useAiPlanner(page: AiPlannerPage) {
  const [session, setSession] = useState<AiSession>(FRESH);
  // The page as it is when an answer arrives, not as it was when asked.
  const latest = useRef(page);
  useEffect(() => {
    latest.current = page;
  });
  // The name Casy gave the event, so a later title only replaces its own.
  const aiTitle = useRef<string | null>(null);

  const ask = useMutation({
    mutationFn: planWithAi,
    onSuccess: ({ plan, left }, input) => {
      const now = latest.current;
      const first = input.current === null;

      now.setSettings(applyPlan(first ? AI_BASE_SETTINGS : now.settings, plan, APP_TIME_ZONE));
      if (first || (plan.title && (now.name.trim() === "" || now.name === aiTitle.current))) {
        now.setName(plan.title ?? "");
        aiTitle.current = plan.title;
      }
      if (first) now.setExtras({ place: plan.place ?? "", note: plan.note ?? "" });
      else {
        if (plan.place) now.setExtras({ place: plan.place });
        if (plan.note) now.setExtras({ note: plan.note });
      }

      const matches = matchNames(mentionedNames(plan), now.members);
      const resolved = Object.fromEntries(
        matches.filter((m) => m.candidates.length === 1).map((m) => [m.written, m.candidates[0]]),
      );
      if (first || matches.length > 0 || plan.atLeast !== null) {
        now.setPeople(applyPeople(first ? NO_PEOPLE_CHOICE : now.peopleChoice, plan, resolved));
      }
      const stateOf = (name: string): MemberState =>
        plan.people.without.includes(name)
          ? "out"
          : plan.people.optional.includes(name)
            ? "optional"
            : "required";

      setSession((s) => {
        const stated = statedFields(plan, plan.assumed);
        return {
          texts: [...s.texts, input.text],
          plan,
          guessed: first
            ? guessedFields(plan, true)
            : [
                ...new Set([
                  ...s.guessed.filter((f) => !stated.includes(f)),
                  ...guessedFields(plan, false),
                ]),
              ],
          questions: plan.questions.map((question) => ({ question, picked: null })),
          names: matches
            .filter((m) => m.candidates.length !== 1)
            .map((m) => ({
              written: m.written,
              state: stateOf(m.written),
              candidates: m.candidates,
              picked: null,
            })),
          left,
        };
      });
    },
  });

  /** Ask about `text`: a first description, or more details on the settings so far. */
  function describe(text: string) {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    ask.mutate({
      text: trimmed,
      earlier: session.texts.slice(-MAX_EARLIER),
      current: session.plan ? toPlanSettings(latest.current.settings, APP_TIME_ZONE) : null,
    });
  }

  /** One of a question's options: its settings applied as they are, no call. */
  function answer(questionIndex: number, optionIndex: number) {
    const option = session.questions[questionIndex]?.question.options[optionIndex];
    if (!option) return;
    latest.current.setSettings(applyPlan(latest.current.settings, option.patch, APP_TIME_ZONE));
    const stated = statedFields(option.patch);
    setSession((s) => ({
      ...s,
      guessed: s.guessed.filter((f) => !stated.includes(f)),
      questions: s.questions.map((q, i) =>
        i === questionIndex ? { ...q, picked: optionIndex } : q,
      ),
    }));
  }

  /** A question answered in the person's own words: one more call. */
  function answerOther(questionIndex: number, text: string) {
    const question = session.questions[questionIndex]?.question.question;
    if (!question || !text.trim()) return;
    describe(`${question} ${text.trim()}`);
  }

  /** Who a name is: a member's id, or "none" for nobody in the group. */
  function pickName(index: number, picked: string) {
    const question = session.names[index];
    if (!question) return;
    if (picked !== "none") {
      const choice = latest.current.peopleChoice;
      latest.current.setPeople({
        ...choice,
        states: { ...choice.states, [picked]: question.state },
      });
    }
    setSession((s) => ({
      ...s,
      names: s.names.map((n, i) => (i === index ? { ...n, picked } : n)),
    }));
  }

  /** The person changed these settings by hand: no longer Casy's guesses. */
  function edited(fields: PlanField[]) {
    if (fields.some((f) => session.guessed.includes(f))) {
      setSession((s) => ({ ...s, guessed: s.guessed.filter((f) => !fields.includes(f)) }));
    }
  }

  /** Start over with a new description. */
  function reset() {
    ask.reset();
    aiTitle.current = null;
    setSession((s) => ({ ...FRESH, left: s.left }));
  }

  return {
    session,
    describe,
    answer,
    answerOther,
    pickName,
    edited,
    reset,
    pending: ask.isPending,
    error: ask.error?.message ?? null,
  };
}

export type AiPlanner = ReturnType<typeof useAiPlanner>;
