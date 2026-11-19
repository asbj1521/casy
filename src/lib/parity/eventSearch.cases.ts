/** eventSearch.ts, startFlex.ts and scheduler.ts's pure helpers, for EventSearch.swift (#282). */
import { findAnswer } from "@/hooks/useDateSearch";
import { findEventSlot, peopleForSearch, type EventSettings } from "@/lib/eventSearch";
import {
  ALL_DOWS,
  daysUntil,
  describeDays,
  fallbackTitleId,
  laterSlots,
  type MemberState,
  peopleFromChoice,
  type Period,
  periodBounds,
  periodWindow,
  pickPeriodMonth,
  reviewAnswer,
  type SchedulerSettings,
  settingsToSearch,
} from "@/lib/scheduler";
import { flexAround, flexOf, flexWindow } from "@/lib/startFlex";
import { startOfMonth } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

/** Runs `body` with Date.now() as `now`, which findAnswer reads for "never a moment already gone". */
function withNow<T>(now: number, body: () => T): T {
  const real = Date.now;
  Date.now = () => now;
  try {
    return body();
  } finally {
    Date.now = real;
  }
}

export function eventSearchCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261120);
  const flag = (odds: number) => random() < odds;

  const block = (): BusyInterval => {
    const start = NOW + int(0, 40 * 24) * HOUR;
    const b: BusyInterval = { start: iso(start), end: iso(start + int(1, 30) * HOUR) };
    if (flag(0.3)) b.category = pick(["work", "school", "social"]);
    if (flag(0.15)) b.priority = pick(["skip", "never"]);
    return b;
  };
  const group = (): Participant[] =>
    Array.from({ length: int(1, 5) }, (_, n) => ({
      profileId: `p${n}`,
      name: `P${n}`,
      busy: Array.from({ length: int(0, 12) }, block),
    }));
  const choice = (members: string[]) => {
    const states: Record<string, MemberState> = {};
    for (const id of members) if (flag(0.4)) states[id] = pick(["required", "optional", "out"]);
    return { states, atLeast: flag(0.4) ? int(0, members.length + 1) : null };
  };
  const month = (n: number) => iso(startOfMonth(NOW, TZ, n));
  const period = (): Period | null =>
    flag(0.3)
      ? null
      : flag(0.3)
        ? {
            from: iso(NOW + int(0, 20) * 24 * HOUR),
            to: iso(NOW + int(21, 60) * 24 * HOUR),
            days: true,
          }
        : (() => {
            const a = int(0, 5);
            return { from: month(a), to: month(a + int(0, 3)) };
          })();
  const settings = (): SchedulerSettings => {
    const startHour = int(7, 21);
    return {
      multiDay: flag(0.35),
      startHour,
      durationMinutes: pick([30, 60, 90, 120, 180, 240]),
      dows: flag(0.5) ? [...ALL_DOWS] : ALL_DOWS.filter(() => flag(0.6)),
      anyTime: flag(0.2),
      startWindow: flag(0.3) ? flexWindow(startHour, pick([30, 60, 90, 120])) : null,
      days: int(1, 9),
      startDow: flag(0.3) ? null : int(0, 6),
      period: period(),
    };
  };

  for (let i = 0; i < 160; i++) {
    const participants = group();
    const members = participants.map((p) => p.profileId).concat(flag(0.3) ? ["nocal"] : []);
    const s = settings();
    const people = peopleFromChoice(members, choice(members), !s.multiDay) ?? undefined;
    const search: EventSettings = settingsToSearch(s, people);
    const searchStart = iso(NOW);
    const searchEnd = iso(NOW + int(10, 45) * 24 * HOUR);
    const found = findEventSlot(participants, search, searchStart, searchEnd, TZ);
    const count = int(1, 4);
    const you = flag(0.5) ? "p0" : "p1";
    const accepted = flag(0.3) ? (found.slot?.start ?? null) : null;
    add(
      "findEventSlot",
      { participants, search, searchStart, searchEnd, count, you, accepted },
      {
        found,
        people: peopleForSearch(participants, search.people),
        title: fallbackTitleId(search),
        later: found.slot
          ? laterSlots(participants, search, found.slot.start, count, searchEnd, TZ)
          : [],
        review: reviewAnswer(found, search, you, accepted),
      },
    );
  }

  for (let i = 0; i < 70; i++) {
    const participants = group();
    const s = settings();
    const search = settingsToSearch(s);
    const windowStart = iso(NOW + int(0, 5) * 24 * HOUR);
    const windowEnd = iso(NOW + int(20, 60) * 24 * HOUR);
    const from = flag(0.3) ? null : iso(NOW + int(0, 30) * 24 * HOUR);
    const day = flag(0.4);
    const bigOn = flag(0.5) ? pick([4, 11, 18]) : null;
    const now = NOW + int(0, 3) * HOUR;
    // The date's day, as Planlæg's Date.now() is the case's own `now`.
    const found = withNow(now, () =>
      findAnswer(
        participants,
        search,
        { from, day },
        { start: windowStart, end: windowEnd },
        (slot) => bigOn !== null && new Date(slot.start).getUTCDate() === bigOn,
      ),
    );
    add("answer", { participants, search, from, day, windowStart, windowEnd, bigOn, now }, found);
  }

  for (let i = 0; i < 80; i++) {
    const members = Array.from({ length: int(1, 6) }, (_, n) => `m${n}`);
    const c = choice(members);
    const meeting = flag(0.6);
    add(
      "peopleFromChoice",
      { members, choice: c, meeting },
      peopleFromChoice(members, c, meeting) ?? null,
    );
  }

  for (let i = 0; i < 80; i++) {
    const s = settings();
    add(
      "settings",
      { settings: s },
      {
        search: settingsToSearch(s),
        flex: flexOf(s),
        days: describeDays(s.dows),
      },
    );
    const p = s.period;
    const m = month(int(0, 7));
    add(
      "period",
      { period: p, month: m },
      {
        picked: pickPeriodMonth(p, m, TZ),
        window: periodWindow(p, iso(NOW), { start: month(0), end: month(12) }, TZ),
        bounds: p ? periodBounds(p, TZ) : null,
      },
    );
  }

  for (let i = 0; i < 40; i++) {
    const from = int(0, 46) * 30;
    const window = { from, to: from + int(1, 10) * 30 };
    const hour = int(0, 23);
    const flex = pick([0, 30, 60, 90, 120]);
    add(
      "flex",
      { window, hour, flex },
      { around: flexAround(window), own: flexWindow(hour, flex) },
    );
    const day = iso(NOW + int(-5, 400) * 24 * HOUR);
    add("daysUntil", { day, today: iso(NOW) }, daysUntil(day, iso(NOW)));
  }

  return cases;
}
