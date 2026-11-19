/** candidates.ts, for Candidates.swift (#282). */
import type { EventImpact } from "@/api/eventProfile";
import { findPoolAcross, rankFromPool } from "@/lib/candidates";
import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { EFFECTS } from "@/lib/eventVocabulary";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

/** 7 December: the pool reaches 1 January within the window searched. */
const NOW = Date.UTC(2026, 11, 7, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

export function candidatesCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261122);
  const flag = (odds: number) => random() < odds;

  const block = (): BusyInterval => {
    const start = NOW + int(0, 60 * 24) * HOUR;
    const b: BusyInterval = { start: iso(start), end: iso(start + pick([1, 2, 3, 9, 26]) * HOUR) };
    if (flag(0.4)) b.category = pick(["work", "school", "social"]);
    if (flag(0.2)) b.priority = pick(["skip", "never"]);
    return b;
  };
  const meeting = (startHour: number): EventSettings => ({
    kind: "single",
    durationMinutes: pick([60, 120, 180]),
    startHour,
    ...(flag(0.3) ? { anyTime: true } : {}),
    ...(flag(0.3) ? { allowedDays: [1, 2, 3, 4, 5, 6, 0].filter(() => flag(0.7)) } : {}),
  });

  for (let i = 0; i < 120; i++) {
    const participants: Participant[] = Array.from({ length: int(1, 4) }, (_, n) => ({
      profileId: `p${n}`,
      name: `P${n}`,
      busy: Array.from({ length: int(0, 50) }, block),
    }));
    const kind = pick(["single", "single", "single", "trip", "vacation"] as const);
    const startHour = int(10, 20);
    const searches: EventSettings[] =
      kind === "single"
        ? flag(0.3)
          ? [meeting(startHour), meeting(startHour + 1)]
          : [meeting(startHour)]
        : kind === "trip"
          ? [
              {
                kind,
                shape: { anchorDow: pick([4, 5]), spanDays: int(2, 3), startHour: 17, endHour: 21 },
              },
            ]
          : [{ kind, days: int(2, 6) }];
    const search = searches[0];
    const start = iso(NOW);
    const end = iso(NOW + int(20, 60) * 24 * HOUR);
    const first = findEventSlot(participants, search, start, end, TZ);
    if (!first.slot) continue;
    const firstDate = { slot: first.slot, conflicts: first.conflicts };
    const profile: EventImpact | null = flag(0.5)
      ? null
      : {
          v: 1,
          effects: EFFECTS.filter(() => flag(0.3)),
          runsLate: flag(0.3),
          strain: pick(["none", "light", "moderate", "heavy"]),
          recoveryDays: 0,
          outdoors: false,
          daylight: false,
          confidence: "high",
          reason: "",
        };
    const priority = flag(0.3) ? ("soon" as const) : ("hassle" as const);
    const everyTime = searches.length > 1;
    const count = pick([3, 4, 5, 5]);
    const options = { first: firstDate, end, count, profile, now: NOW, priority, everyTime };
    const pool = findPoolAcross(participants, searches, options, TZ);
    const scoreStarts = pool.filter(() => flag(0.3)).map((d) => d.slot.start);
    const scores = Object.fromEntries(scoreStarts.map((s) => [s, int(30, 100)]));
    const ranked = rankFromPool(
      pool,
      participants,
      search,
      { ...options, scores: new Map(Object.entries(scores)) },
      TZ,
    );
    add(
      "candidates",
      {
        participants,
        searches,
        first: firstDate,
        end,
        count,
        profile,
        priority,
        everyTime,
        scores,
      },
      {
        pool: ranked.pool.map((d) => d.slot.start),
        chosen: ranked.chosen.map((d) => d.slot.start),
        byPick: ranked.byPick.map((d) => d.slot.start),
        costs: ranked.pool.map((d) => ranked.comfort.get(d)?.cost ?? null),
      },
    );
  }
  return cases;
}
