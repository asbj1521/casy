/** aiPlan.ts, for AiPlan.swift (#282). */
import {
  AI_BASE_SETTINGS,
  type AiPlan,
  applyPeople,
  applyPlan,
  guessedFields,
  matchNames,
  mentionedNames,
  type PlanSettings,
  statedFields,
  toPlanSettings,
} from "@/lib/aiPlan";
import { ALL_DOWS, type PeopleChoice, type SchedulerSettings } from "@/lib/scheduler";

import { caseBook, type ParityCase } from "./cases";

const TZ = "Europe/Copenhagen";
const FIELDS = [
  "kind",
  "startHour",
  "anyTime",
  "startWindow",
  "durationMinutes",
  "weekdays",
  "days",
  "startWeekday",
  "months",
] as const;
const NAMES = ["Søren Ærø", "Jonas", "Jonas Berg", "Émile", "Anne-Sofie", "Mia", "  Sara   Holm "];
const WRITTEN = [
  "soren",
  "Søren Ærø",
  "jonas",
  "Jonas berg",
  "Emile",
  "anne-sofie",
  "Ida",
  "sara holm",
  "SARA",
];

export function aiPlanCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261126);
  const flag = (odds: number) => random() < odds;
  const maybe = <T>(v: T): T | null => (flag(0.5) ? v : null);

  const planSettings = (): PlanSettings => ({
    kind: maybe(pick(["meeting", "trip", "holiday"] as const)),
    startHour: maybe(pick([int(0, 23), 3.5, 24, -1])),
    anyTime: maybe(flag(0.5)),
    startWindow: maybe(
      pick([
        { from: 1080, to: 1260 },
        { from: 600, to: 630 },
        { from: 615, to: 700 },
        { from: 1200, to: 1100 },
      ]),
    ),
    durationMinutes: maybe(pick([30, 60, 90, 120, 45, 750, 180])),
    weekdays: maybe(pick([[1, 2, 3], [6, 0], [7, 2.5], [], [5]])),
    days: maybe(pick([int(1, 30), 0, 31, 2.5])),
    startWeekday: maybe(pick([int(0, 6), 7, 1.5])),
    months: maybe(
      pick([
        "any" as const,
        { from: "2026-11", to: "2027-01" },
        { from: "2027-02", to: "2026-12" },
        { from: "2026-13", to: "2027-01" },
        { from: "2026-11-05", to: "2026-11-12", days: true as const },
        { from: "2026-02-30", to: "2026-03-02", days: true as const },
        { from: "2026-11-12", to: "2026-11-05", days: true as const },
      ]),
    ),
  });
  const settings = (): SchedulerSettings => ({
    ...AI_BASE_SETTINGS,
    multiDay: flag(0.3),
    startHour: int(8, 21),
    anyTime: flag(0.2),
    dows: flag(0.5) ? [...ALL_DOWS] : ALL_DOWS.filter(() => flag(0.6)),
    days: int(1, 9),
    startDow: flag(0.3) ? null : int(0, 6),
    period: flag(0.5)
      ? null
      : flag(0.5)
        ? { from: "2026-10-31T23:00:00.000Z", to: "2026-12-31T23:00:00.000Z" }
        : { from: "2026-11-04T23:00:00.000Z", to: "2026-11-11T23:00:00.000Z", days: true },
  });

  for (let i = 0; i < 150; i++) {
    const s = settings();
    const p = planSettings();
    const applied = applyPlan(s, p, TZ);
    add("apply", { settings: s, plan: p }, { applied, back: toPlanSettings(applied, TZ) });
  }

  for (let i = 0; i < 80; i++) {
    const plan: AiPlan = {
      ...planSettings(),
      title: maybe("Brætspil"),
      place: maybe("Hos Jonas"),
      note: null,
      people: {
        without: WRITTEN.filter(() => flag(0.15)),
        optional: WRITTEN.filter(() => flag(0.15)),
        required: WRITTEN.filter(() => flag(0.15)),
      },
      atLeast: maybe(pick([int(1, 20), 0, 2.5])),
      assumed: FIELDS.filter(() => flag(0.2)),
      questions: [],
    };
    const members = NAMES.map((name, n) => ({ profileId: `p${n}`, name, isYou: n === 5 }));
    const names = mentionedNames(plan);
    const matches = matchNames(names, members);
    const resolved = Object.fromEntries(
      matches.filter((m) => m.candidates.length === 1).map((m) => [m.written, m.candidates[0]]),
    );
    const choice: PeopleChoice = {
      states: flag(0.5) ? { p1: "optional" } : {},
      atLeast: maybe(3),
    };
    add(
      "plan",
      { plan, members, choice },
      {
        names,
        matches,
        people: applyPeople(choice, plan, resolved),
        guessedFirst: guessedFields(plan, true),
        guessedLater: guessedFields(plan, false),
        stated: statedFields(plan, plan.assumed).filter((f) =>
          (FIELDS as readonly string[]).includes(f),
        ),
      },
    );
  }
  return cases;
}
