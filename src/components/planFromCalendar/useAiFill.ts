import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { haptic } from "@/lib/haptics";
import type { EventExtras, PeopleChoice, SchedulerSettings } from "@/lib/scheduler";
import { flexOf } from "@/lib/startFlex";

/** The sheet's rows Casy fills in, in the order they stand. */
export type FillKey =
  "name" | "kind" | "time" | "flex" | "days" | "tripDays" | "startDay" | "months" | "more";

/** What the sheet holds: before Casy answered, and after. */
export interface PlanState {
  name: string;
  settings: SchedulerSettings;
  extras: EventExtras;
  people: PeopleChoice;
}

interface Step {
  key: FillKey;
  patch: Partial<SchedulerSettings>;
}

/** How long each row holds the light before the next one is filled. */
const STEP_MS = 320;
/** A letter deleted, a letter typed. */
const DELETE_MS = 18;
const TYPE_MS = 45;
/** The longest the name may take either way, however long the text. */
const NAME_TICKS = 14;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The rows that changed from `from` to `to`, each with what it sets. */
function fillSteps(from: PlanState, to: PlanState): Step[] {
  const a = from.settings;
  const b = to.settings;
  const steps: Step[] = [];
  if (a.multiDay !== b.multiDay) steps.push({ key: "kind", patch: { multiDay: b.multiDay } });
  if (b.multiDay) {
    if (a.days !== b.days) steps.push({ key: "tripDays", patch: { days: b.days } });
    if (a.startDow !== b.startDow) steps.push({ key: "startDay", patch: { startDow: b.startDow } });
  } else {
    // A window Casy chose itself is the time row's; one around the hour is Fleksibel's.
    const ownWindow = flexOf(b) === null;
    if (
      a.startHour !== b.startHour ||
      a.durationMinutes !== b.durationMinutes ||
      a.anyTime !== b.anyTime ||
      (ownWindow && !same(a.startWindow, b.startWindow))
    ) {
      steps.push({
        key: "time",
        patch: {
          startHour: b.startHour,
          durationMinutes: b.durationMinutes,
          anyTime: b.anyTime,
          startWindow: ownWindow ? b.startWindow : a.startWindow,
        },
      });
    }
    if (!ownWindow && !b.anyTime && !same(a.startWindow, b.startWindow)) {
      steps.push({ key: "flex", patch: { startWindow: b.startWindow } });
    }
    if (!same(a.dows, b.dows)) steps.push({ key: "days", patch: { dows: b.dows } });
  }
  if (!same(a.period, b.period)) steps.push({ key: "months", patch: { period: b.period } });
  if (!same(from.extras, to.extras) || !same(from.people, to.people)) {
    steps.push({ key: "more", patch: {} });
  }
  return steps;
}

/**
 * Casy filling in the Planlæg sheet as if by hand (#173): its answer is
 * already in the plan, but the sheet shows the plan as it was and plays the
 * difference back, a row at a time. The name is deleted and typed letter by
 * letter, then each row that changed takes its new value with a soft orange
 * light (`lit`) and a tick of the phone, in the order the rows stand. Under
 * reduced motion the answer is simply there. While it plays, `settings` and
 * `name` are what to show instead of the plan's own.
 */
export function useAiFill(live: PlanState) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState<{ from: PlanState; tick: number } | null>(null);

  const steps = run ? fillSteps(run.from, live) : [];
  // The name first: ticks while deleting and typing, then one per row.
  const oldName = run?.from.name ?? "";
  const newName = live.name;
  const typesName = run !== null && oldName !== newName;
  const delTicks = typesName ? Math.min(NAME_TICKS, oldName.length) : 0;
  const typeTicks = typesName ? Math.min(NAME_TICKS * 2, newName.length) : 0;
  const nameTicks = delTicks + typeTicks;
  const total = nameTicks + steps.length;

  useEffect(() => {
    // Held: the sheet as it was, until Casy's questions are answered.
    if (!run || run.tick < 0) return;
    if (run.tick >= total) {
      // The last light fades before the sheet is the plan's own again.
      const id = window.setTimeout(() => setRun(null), STEP_MS * 2);
      return () => window.clearTimeout(id);
    }
    const inName = run.tick < nameTicks;
    if (!inName) haptic("tick");
    const delay = inName ? (run.tick < delTicks ? DELETE_MS : TYPE_MS) : STEP_MS;
    const id = window.setTimeout(() => setRun((r) => (r ? { ...r, tick: r.tick + 1 } : r)), delay);
    return () => window.clearTimeout(id);
  }, [run, total, nameTicks, delTicks]);

  /** Play Casy's answer back from the sheet as it was before it was asked. */
  function start(from: PlanState) {
    setRun(reduce ? null : { from, tick: 0 });
  }
  /** Show the sheet as it was while Casy's questions are open, its answer kept for after. */
  function hold(from: PlanState) {
    if (!reduce) setRun({ from, tick: -1 });
  }

  if (!run) return { start, hold, active: false, settings: null, name: null, lit: null };
  if (run.tick < 0) {
    return {
      start,
      hold,
      active: true,
      settings: run.from.settings,
      name: run.from.name,
      lit: null,
    };
  }

  const tick = run.tick;
  let name = newName;
  if (tick < delTicks) {
    name = oldName.slice(0, Math.round(oldName.length * (1 - tick / delTicks)));
  } else if (tick < nameTicks) {
    name = newName.slice(0, Math.round(newName.length * ((tick - delTicks) / typeTicks)));
  }
  const done = Math.max(0, tick - nameTicks + 1);
  const settings = steps
    .slice(0, done)
    .reduce((s, step) => ({ ...s, ...step.patch }), run.from.settings);
  const lit: FillKey | null =
    tick < nameTicks ? "name" : tick < total ? (steps[tick - nameTicks]?.key ?? null) : null;
  return {
    start,
    hold,
    active: true,
    // Past the last row, whatever no row shows is the plan's too.
    settings: tick >= total ? live.settings : settings,
    name,
    lit,
  };
}
