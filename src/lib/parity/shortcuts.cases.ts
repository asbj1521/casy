/** shortcuts.ts and answerSteps.ts, for Shortcuts.swift (#282). */
import {
  accept,
  back,
  currentStep,
  forward,
  jump,
  restart,
  type AnswerSteps,
} from "@/lib/answerSteps";
import { ALL_DOWS, DEFAULT_EXTRAS, type SchedulerSettings } from "@/lib/scheduler";
import { readShortcutPlan, shortcutPlan, timeLabel, timeOf } from "@/lib/shortcuts";

import { caseBook, type ParityCase } from "./cases";

export function shortcutsCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261125);
  const flag = (odds: number) => random() < odds;

  const settings = (): SchedulerSettings => {
    const startHour = int(0, 23) + pick([0, 0, 0.5]);
    return {
      multiDay: flag(0.3),
      startHour,
      durationMinutes: pick([30, 60, 90, 120, 180, 240, 600]),
      dows: flag(0.5) ? [...ALL_DOWS] : ALL_DOWS.filter(() => flag(0.6)),
      anyTime: flag(0.2),
      startWindow: flag(0.3) ? { from: startHour * 60 - 60, to: startHour * 60 + 60 } : null,
      days: int(1, 9),
      startDow: flag(0.3) ? null : int(0, 6),
      period: null,
    };
  };
  /** A value of the right kind, now and then a wrong one, as an old or damaged row might hold. */
  const junk = (good: unknown): unknown =>
    flag(0.75) ? good : pick([null, "x", -5, 99999, true, [], {}, 3.5, undefined]);

  for (let i = 0; i < 120; i++) {
    const base = settings();
    const s = settings();
    const times = Array.from({ length: int(1, 4) }, () => timeOf(settings()));
    const answerDays = int(1, 7);
    const plan = shortcutPlan(s, { ...DEFAULT_EXTRAS, place: "Hos Jonas", answerDays }, times);
    const raw: Record<string, unknown> = flag(0.1)
      ? { v: 2 }
      : {
          v: junk(1),
          settings: flag(0.05)
            ? "nope"
            : Object.fromEntries(Object.entries(plan.settings).map(([k, v]) => [k, junk(v)])),
          times: junk(plan.times.map((t) => (flag(0.2) ? junk(t) : t))),
          extras: junk({
            place: junk("Hos Jonas"),
            note: junk("Tag et spil med"),
            answerDays: junk(int(0, 9)),
            dateCount: junk(int(1, 6)),
            priority: junk(pick(["soon", "hassle", "other"])),
          }),
        };
    const stored = JSON.parse(JSON.stringify(raw)) as unknown;
    add(
      "shortcut",
      { raw: stored, base, settings: s, times, answerDays },
      {
        plan,
        read: readShortcutPlan(stored, base),
        labels: times.map((t) => timeLabel(t, "Hele dagen")),
      },
    );
  }

  for (let i = 0; i < 40; i++) {
    let s: AnswerSteps = restart(flag(0.5) ? null : "2026-10-10T22:00:00.000Z");
    const moves: string[] = [];
    for (let k = 0; k < int(1, 12); k++) {
      const move = pick(["jump", "day", "forward", "back", "accept"]);
      const at = `2026-10-${String(int(10, 28)).padStart(2, "0")}T22:00:00.000Z`;
      moves.push(`${move} ${at}`);
      s =
        move === "jump"
          ? jump(s, at)
          : move === "day"
            ? jump(s, at, true)
            : move === "forward"
              ? forward(s, at)
              : move === "back"
                ? back(s)
                : accept(s, at);
    }
    add("steps", { start: s.steps[0].from, moves }, { state: s, current: currentStep(s) });
  }
  return cases;
}
