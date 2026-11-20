/** widen.ts, for Widen.swift (#282). */
import { ALL_DOWS, type MemberState, type Period, type SchedulerSettings } from "@/lib/scheduler";
import type { EventSettings } from "@/lib/eventSearch";
import { planFromVote, withAnswers } from "@/lib/searchAgain";
import { flexWindow } from "@/lib/startFlex";
import { daysSooner, firstDateByCount, lowestCount, widenOptions } from "@/lib/widen";
import { startOfDay, startOfMonth } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

export function widenCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261123);
  const flag = (odds: number) => random() < odds;

  /** Busy enough that the plan often finds nothing, or something late. */
  const block = (): BusyInterval => {
    const start = NOW + int(0, 90 * 24) * HOUR;
    const b: BusyInterval = {
      start: iso(start),
      end: iso(start + pick([2, 3, 5, 9, 30, 72]) * HOUR),
    };
    if (flag(0.3)) b.category = pick(["work", "school", "social"]);
    if (flag(0.1)) b.priority = "never";
    return b;
  };
  const month = (n: number) => iso(startOfMonth(NOW, TZ, n));
  const today = iso(startOfDay(NOW, TZ));

  for (let i = 0; i < 90; i++) {
    const participants: Participant[] = Array.from({ length: int(2, 5) }, (_, n) => ({
      profileId: `p${n}`,
      name: `P${n}`,
      busy: Array.from({ length: int(10, 80) }, block),
    }));
    const members = participants.map((p) => p.profileId);
    const states: Record<string, MemberState> = {};
    for (const id of members) if (flag(0.2)) states[id] = pick(["optional", "out"]);
    const choice = { states, atLeast: flag(0.3) ? int(2, members.length) : null };
    const startHour = int(9, 20);
    const a = int(0, 3);
    const period: Period | null = flag(0.4) ? null : { from: month(a), to: month(a + int(0, 1)) };
    const settings: SchedulerSettings = {
      multiDay: flag(0.3),
      startHour,
      durationMinutes: pick([60, 120, 180, 240]),
      dows: flag(0.5) ? [...ALL_DOWS] : ALL_DOWS.filter(() => flag(0.5)),
      anyTime: flag(0.15),
      startWindow: flag(0.25) ? flexWindow(startHour, pick([30, 60])) : null,
      days: int(2, 8),
      startDow: flag(0.3) ? null : int(0, 6),
      period,
    };
    const input = {
      participants,
      settings,
      members,
      choice,
      today,
      limit: { start: month(0), end: month(12) },
      timeZone: TZ,
      now: NOW,
    };
    const others = settings.multiDay
      ? []
      : [{ ...settings, startHour: Math.min(23, startHour + 2) }];
    add(
      "widen",
      { participants, settings, members, choice, others },
      { options: widenOptions(input), counts: firstDateByCount(input, others) },
    );
  }

  for (let i = 0; i < 30; i++) {
    const of = int(1, 12);
    const atLeast = flag(0.5) ? int(1, of) : null;
    const first = iso(NOW + int(0, 90) * 24 * HOUR);
    const than = iso(NOW + int(0, 90) * 24 * HOUR);
    add(
      "counts",
      { of, atLeast, first, than },
      { lowest: lowestCount(of, atLeast), sooner: daysSooner(first, than, TZ) },
    );
  }
  // searchAgain.ts (#240): the vote's plan as Planlæg's, and its answers counted.
  const ANSWERS = ["accepted", "maybe", "declined"] as const;
  for (let i = 0; i < 40; i++) {
    const group = Array.from({ length: int(2, 6) }, (_, n) => `m${n}`);
    const invited = group.filter((_, n) => n === 0 || flag(0.7));
    const people = flag(0.6)
      ? {
          members: invited,
          optional: invited.filter(() => flag(0.3)),
          ...(flag(0.4) ? { atLeast: int(2, Math.max(2, invited.length)) } : {}),
        }
      : undefined;
    const kind = pick(["single", "trip", "vacation"] as const);
    const window = flag(0.3) ? flexWindow(int(9, 19), pick([30, 60])) : null;
    const settings: EventSettings =
      kind === "single"
        ? {
            kind,
            startHour: int(8, 20),
            durationMinutes: pick([60, 120, 180]),
            ...(flag(0.3) ? { anyTime: true } : {}),
            ...(window ? { startWindow: window } : {}),
            ...(flag(0.5) ? { allowedDays: ALL_DOWS.filter(() => flag(0.6)) } : {}),
            ...(people ? { people } : {}),
          }
        : kind === "trip"
          ? {
              kind,
              shape: { anchorDow: int(0, 6), spanDays: int(2, 5), startHour: 0, endHour: 24 },
              ...(people ? { people } : {}),
            }
          : { kind, days: int(2, 9), ...(people ? { people } : {}) };
    const base: SchedulerSettings = {
      multiDay: false,
      startHour: 17,
      durationMinutes: 120,
      dows: [...ALL_DOWS],
      anyTime: false,
      startWindow: null,
      days: 3,
      startDow: 5,
      period: { from: month(1), to: month(2) },
    };
    const plan = planFromVote(settings, invited, group);
    add(
      "planFromVote",
      { settings, invited, group, base },
      { sched: { ...base, ...plan.sched }, people: plan.people },
    );

    const participants: Participant[] = invited.map((id) => ({
      profileId: id,
      name: id,
      busy: Array.from({ length: int(0, 3) }, block),
    }));
    const dates = Array.from({ length: int(1, 4) }, (_, k) => {
      const start = NOW + int(1, 60) * 24 * HOUR;
      return {
        id: `d${k}`,
        start: iso(start),
        end: iso(start + 2 * HOUR),
        answers: Object.fromEntries(
          invited.filter(() => flag(0.7)).map((id) => [id, pick(ANSWERS)]),
        ),
      };
    });
    add("withAnswers", { participants, dates }, withAnswers(participants, dates));
  }
  return cases;
}
