/** monthAvailability.ts, for MonthAvailability.swift (#282). */
import type { EventSettings } from "@/lib/eventSearch";
import { monthAvailability } from "@/lib/monthAvailability";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

export function monthAvailabilityCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261124);
  const flag = (odds: number) => random() < odds;

  const block = (): BusyInterval => {
    const start = NOW + int(-10 * 24, 120 * 24) * HOUR;
    const b: BusyInterval = {
      start: iso(start),
      end: iso(start + pick([1, 2, 4, 9, 24, 50]) * HOUR),
    };
    if (flag(0.3)) b.category = pick(["work", "school", "social"]);
    if (flag(0.25)) b.priority = pick(["skip", "never"]);
    return b;
  };

  for (let i = 0; i < 70; i++) {
    const participants: Participant[] = Array.from({ length: int(1, 5) }, (_, n) => ({
      profileId: `p${n}`,
      name: `P${n}`,
      busy: Array.from({ length: int(0, 60) }, block),
    }));
    const kind = pick(["single", "single", "single", "trip", "vacation"] as const);
    const startHour = int(9, 20);
    const search: EventSettings =
      kind === "single"
        ? {
            kind,
            durationMinutes: pick([60, 120, 180]),
            startHour,
            ...(flag(0.25) ? { anyTime: true } : {}),
            ...(flag(0.25)
              ? { startWindow: { from: startHour * 60 - 60, to: startHour * 60 + 60 } }
              : {}),
            ...(flag(0.3) ? { allowedDays: [0, 1, 2, 3, 4, 5, 6].filter(() => flag(0.6)) } : {}),
          }
        : kind === "trip"
          ? {
              kind,
              shape: { anchorDow: int(0, 6), spanDays: int(1, 4), startHour: 17, endHour: 21 },
            }
          : { kind, days: int(2, 7) };
    if (flag(0.3)) {
      search.people = {
        members: participants.map((p) => p.profileId).concat(["nocal"]),
        optional: [],
        ...(kind === "single" ? { atLeast: int(1, participants.length) } : {}),
      };
    }
    const year = 2026 + int(0, 1);
    const month = year === 2026 ? int(9, 11) : int(0, 2);
    const windowEndMs = NOW + int(30, 120) * 24 * HOUR;
    add(
      "month",
      { participants, search, year, month, windowEndMs },
      monthAvailability(participants, search, year, month, {
        timeZone: TZ,
        todayMs: NOW,
        windowEndMs,
      }),
    );
  }
  return cases;
}
