/** widen.ts, for Widen.swift (#282). */
import { ALL_DOWS, type MemberState, type Period, type SchedulerSettings } from "@/lib/scheduler";
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
  return cases;
}
