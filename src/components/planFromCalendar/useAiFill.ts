import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { haptic } from "@/lib/haptics";
import {
  ALL_DOWS,
  type EventExtras,
  type PeopleChoice,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { flexOf, flexWindow } from "@/lib/startFlex";

/** The sheet's rows Casy fills in, in the order they stand. */
export type FillKey =
  "name" | "kind" | "time" | "flex" | "days" | "tripDays" | "startDay" | "months" | "more";

/** A row's own sheet, opened while Casy uses it. */
export type FillSheet = "time" | "days" | "startDay";

/** A stepper's button Casy is pressing. */
export type FillPress = "flexLess" | "flexMore" | "tripLess" | "tripMore";

/** What the sheet holds: before Casy answered, and after. */
export interface PlanState {
  name: string;
  settings: SchedulerSettings;
  extras: EventExtras;
  people: PeopleChoice;
}

/** One moment of Casy's filling in: what the sheet shows, and for how long. */
interface Frame {
  name: string;
  settings: SchedulerSettings;
  lit: FillKey | null;
  sheet: FillSheet | null;
  press: FillPress | null;
  ms: number;
}

/** A sheet growing open or shrinking shut, before the next move. */
const SHEET_MS = 480;
/** A wheel rolling to its value. */
const WHEEL_MS = 750;
/** A tap: a stepper's button, a day, a month. */
const TAP_MS = 300;
/** A letter deleted, a letter typed. */
const DELETE_MS = 18;
const TYPE_MS = 45;
/** The longest the name may take either way, however long the text. */
const NAME_TICKS = 14;
/** The most taps a stepper gets before it takes bigger steps. */
const MAX_TAPS = 8;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** The day sheet's quick picks, as sets of days. */
const PRESETS = [[...ALL_DOWS], [1, 2, 3, 4, 5], [6, 0], [5, 6]];
const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && a.every((d) => b.includes(d));

/**
 * Casy's filling in as a person would do it by hand, frame by frame: the
 * name deleted and typed, Møde or Tur switched, the time sheet opened and
 * its wheels rolled to the start and the end, Fleksibel's plus pressed half
 * an hour at a time, the day sheet opened and its quick pick or days tapped,
 * the months tapped. Only what changed is done.
 */
function script(from: PlanState, to: PlanState): Frame[] {
  const frames: Frame[] = [];
  let name = from.name;
  let s = from.settings;
  const b = to.settings;
  const push = (
    patch: Partial<SchedulerSettings>,
    ms: number,
    moment: Partial<Pick<Frame, "lit" | "sheet" | "press">> = {},
  ) => {
    s = { ...s, ...patch };
    frames.push({ name, settings: s, lit: null, sheet: null, press: null, ms, ...moment });
  };

  if (from.name !== to.name) {
    const del = Math.min(NAME_TICKS, from.name.length);
    for (let i = 1; i <= del; i++) {
      name = from.name.slice(0, Math.round(from.name.length * (1 - i / del)));
      push({}, DELETE_MS, { lit: "name" });
    }
    const type = Math.min(NAME_TICKS * 2, to.name.length);
    for (let i = 1; i <= type; i++) {
      name = to.name.slice(0, Math.round(to.name.length * (i / type)));
      push({}, TYPE_MS, { lit: "name" });
    }
  }

  if (s.multiDay !== b.multiDay) push({ multiDay: b.multiDay }, SHEET_MS, { lit: "kind" });

  if (!b.multiDay) {
    if (
      s.startHour !== b.startHour ||
      s.anyTime !== b.anyTime ||
      s.durationMinutes !== b.durationMinutes
    ) {
      const at = { lit: "time", sheet: "time" } as const;
      push({}, SHEET_MS, at);
      if (s.startHour !== b.startHour || s.anyTime !== b.anyTime) {
        // The flexibility goes along with the hour, as a new hour picked by hand keeps it.
        const flex = flexOf(s) ?? 0;
        push(
          {
            startHour: b.startHour,
            anyTime: b.anyTime,
            startWindow: flexWindow(b.startHour, flex),
          },
          WHEEL_MS,
          at,
        );
      }
      if (s.durationMinutes !== b.durationMinutes) {
        push({ durationMinutes: b.durationMinutes }, WHEEL_MS, at);
      }
      push({}, SHEET_MS, { lit: "time" });
    }
    if (!b.anyTime) {
      const want = flexOf(b) ?? 0;
      let flex = flexOf(s) ?? 0;
      while (flex !== want) {
        const up = flex < want;
        flex += up ? 30 : -30;
        push({ startWindow: flexWindow(s.startHour, flex) }, TAP_MS, {
          lit: "flex",
          press: up ? "flexMore" : "flexLess",
        });
      }
    }
    if (!sameDays(s.dows, b.dows)) {
      const at = { lit: "days", sheet: "days" } as const;
      push({}, SHEET_MS, at);
      if (PRESETS.some((p) => sameDays(p, b.dows))) push({ dows: b.dows }, TAP_MS * 2, at);
      else {
        // Day by day: the new ones on first, so at least one is always on.
        for (const d of ALL_DOWS.filter((d) => b.dows.includes(d) && !s.dows.includes(d))) {
          push({ dows: [...s.dows, d] }, TAP_MS, at);
        }
        for (const d of ALL_DOWS.filter((d) => !b.dows.includes(d) && s.dows.includes(d))) {
          push({ dows: s.dows.filter((x) => x !== d) }, TAP_MS, at);
        }
      }
      push({}, SHEET_MS, { lit: "days" });
    }
  } else {
    if (s.days !== b.days) {
      const step = Math.max(1, Math.ceil(Math.abs(b.days - s.days) / MAX_TAPS));
      while (s.days !== b.days) {
        const up = s.days < b.days;
        const days = up ? Math.min(b.days, s.days + step) : Math.max(b.days, s.days - step);
        push({ days }, TAP_MS, { lit: "tripDays", press: up ? "tripMore" : "tripLess" });
      }
    }
    if (s.startDow !== b.startDow) {
      const at = { lit: "startDay", sheet: "startDay" } as const;
      push({}, SHEET_MS, at);
      push({ startDow: b.startDow }, TAP_MS * 2, at);
      push({}, SHEET_MS, { lit: "startDay" });
    }
  }

  if (!same(s.period, b.period)) {
    // A run of months is tapped as a person does: its first, then its last.
    if (b.period && !b.period.days && b.period.from !== b.period.to) {
      push({ period: { from: b.period.from, to: b.period.from } }, TAP_MS * 1.5, {
        lit: "months",
      });
    }
    push({ period: b.period }, TAP_MS * 1.5, { lit: "months" });
  }

  if (!same(from.extras, to.extras) || !same(from.people, to.people)) {
    push({}, TAP_MS * 1.5, { lit: "more" });
  }
  return frames;
}

/**
 * Casy filling in the Planlæg sheet as if by hand (#173). Its answer is
 * already the plan, but the sheet shows the plan as it was and plays the
 * difference back (`script`), each move with a tick of the phone (each
 * letter typed a click, the wheels clicking as they roll), the rows
 * and sheets it uses opened as a person would. Under reduced motion the
 * answer is simply there. While it plays, `settings`, `name`, `lit`, `sheet`
 * and `press` are what to show instead of the plan's own.
 */
export function useAiFill(live: PlanState) {
  const reduce = useReducedMotion();
  // tick -1: held, the sheet as it was while Casy's questions are open.
  const [run, setRun] = useState<{ from: PlanState; tick: number } | null>(null);
  const frames = run ? script(run.from, live) : [];

  useEffect(() => {
    if (!run || run.tick < 0) return;
    const frame = frames[run.tick];
    if (!frame) {
      // The last light fades before the sheet is the plan's own again.
      const id = window.setTimeout(() => setRun(null), SHEET_MS);
      return () => window.clearTimeout(id);
    }
    // A tap for each move, a keyboard's click for each letter typed; the
    // quick deletion before it stays silent, or it would buzz.
    if (frame.lit !== "name") haptic("tick");
    else if (frame.ms === TYPE_MS) haptic("select");
    const id = window.setTimeout(
      () => setRun((r) => (r ? { ...r, tick: r.tick + 1 } : r)),
      frame.ms,
    );
    return () => window.clearTimeout(id);
    // The frames follow from the run and the plan; only a new tick moves on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  /** Play Casy's answer back from the sheet as it was before it was asked. */
  function start(from: PlanState) {
    setRun(reduce ? null : { from, tick: 0 });
  }
  /** Show the sheet as it was while Casy's questions are open, its answer kept for after. */
  function hold(from: PlanState) {
    if (!reduce) setRun({ from, tick: -1 });
  }

  const idle = { start, hold, sheet: null, press: null, lit: null };
  if (!run) return { ...idle, active: false, settings: null, name: null };
  if (run.tick < 0) {
    return { ...idle, active: true, settings: run.from.settings, name: run.from.name };
  }
  const frame = frames[run.tick];
  return {
    start,
    hold,
    active: true,
    // Past the last frame, whatever no row shows is the plan's too.
    settings: frame?.settings ?? live.settings,
    name: frame?.name ?? live.name,
    lit: frame?.lit ?? null,
    sheet: frame?.sheet ?? null,
    press: frame?.press ?? null,
  };
}
