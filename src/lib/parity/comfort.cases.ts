/** eventImpact.ts and dateComfort.ts, for Comfort.swift (#282). */
import type { EventImpact } from "@/api/eventProfile";
import { comfortRater, sunset } from "@/lib/dateComfort";
import { impactOn } from "@/lib/eventImpact";
import type { EventSettings } from "@/lib/eventSearch";
import { EFFECTS } from "@/lib/eventVocabulary";
import { startOfDay } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

export function comfortCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261121);
  const flag = (odds: number) => random() < odds;

  /** Blocks around the evenings and mornings the dates fall on, so the gaps matter. */
  const block = (): BusyInterval => {
    const day = int(0, 200);
    const start = NOW + day * 24 * HOUR + int(-2, 14) * HOUR + pick([0, 15, 30, 45]) * 60_000;
    const b: BusyInterval = { start: iso(start), end: iso(start + pick([1, 2, 3, 8, 30]) * HOUR) };
    if (flag(0.4)) b.category = pick(["work", "school", "social", "family"]);
    if (flag(0.2)) b.priority = pick(["skip", "never", "normal"]);
    if (flag(0.05)) b.holiday = true;
    return b;
  };
  const profile = (): EventImpact | null =>
    flag(0.4)
      ? null
      : {
          v: 1,
          effects: EFFECTS.filter(() => flag(0.3)),
          runsLate: flag(0.3),
          strain: pick(["none", "light", "moderate", "heavy"]),
          recoveryDays: int(0, 2),
          outdoors: flag(0.3),
          daylight: flag(0.3),
          confidence: pick(["low", "medium", "high"]),
          reason: "",
        };

  for (let i = 0; i < 120; i++) {
    const participants: Participant[] = Array.from({ length: int(1, 4) }, (_, n) => ({
      profileId: `p${n}`,
      name: `P${n}`,
      busy: Array.from({ length: int(0, 40) }, block),
    }));
    const kind = pick(["single", "single", "single", "trip", "vacation"] as const);
    const settings: EventSettings =
      kind === "single"
        ? { kind, durationMinutes: pick([60, 120, 180, 240]), startHour: int(8, 21) }
        : kind === "trip"
          ? { kind, shape: { anchorDow: 5, spanDays: 3, startHour: 17, endHour: 21 } }
          : { kind, days: int(2, 9) };
    if (flag(0.3)) {
      settings.people = {
        members: participants.map((p) => p.profileId),
        optional: participants
          .slice(1)
          .filter(() => flag(0.4))
          .map((p) => p.profileId),
      };
    }
    const p = profile();
    const rate = comfortRater({ participants, settings, profile: p, timeZone: TZ, now: NOW });
    const dates = Array.from({ length: int(1, 6) }, () => {
      const start = NOW + int(-1, 220) * 24 * HOUR + int(-1, 14) * HOUR + pick([0, 30]) * 60_000;
      const hours = kind === "single" ? pick([1, 2, 3, 4, 6]) : int(2, 9) * 24;
      return { start: iso(start), end: iso(start + hours * HOUR) };
    });
    const scores = dates.map(() => (flag(0.3) ? int(0, 100) : null));
    add(
      "comfort",
      { participants, settings, profile: p, dates, scores },
      dates.map((d, k) => ({
        comfort: rate(d, scores[k] ?? undefined),
        impact: impactOn(p, d, settings, TZ),
      })),
    );
  }

  // Dates with plans right before and after them, and work early the next
  // morning: the tight gaps, the sandwich and the early start after a late night.
  for (let i = 0; i < 100; i++) {
    const settings: EventSettings = {
      kind: "single",
      durationMinutes: pick([120, 180, 240]),
      startHour: pick([17, 18, 19, 20]),
    };
    const day = startOfDay(NOW + int(1, 90) * 24 * HOUR, TZ);
    const start = day + settings.startHour * HOUR - 2 * HOUR + pick([0, 30]) * 60_000;
    const end = start + settings.durationMinutes * 60_000 + pick([0, 2, 3]) * HOUR;
    const date = { start: iso(start), end: iso(end) };
    const participants: Participant[] = Array.from({ length: int(1, 4) }, (_, n) => {
      const busy: BusyInterval[] = [];
      if (flag(0.7)) {
        const gap = pick([0, 10, 20, 40, 60]) * 60_000;
        busy.push({
          start: iso(start - gap - 3 * HOUR),
          end: iso(start - gap),
          ...(flag(0.5) ? { category: pick(["work", "school"] as const) } : {}),
          ...(flag(0.3) ? { priority: pick(["never", "skip"] as const) } : {}),
        });
      }
      if (flag(0.6)) {
        const gap = pick([0, 10, 25, 50]) * 60_000;
        busy.push({
          start: iso(end + gap),
          end: iso(end + gap + HOUR),
          ...(flag(0.3) ? { priority: "never" as const } : {}),
        });
      }
      if (flag(0.6)) {
        const morning = startOfDay(end, TZ) + (startOfDay(end, TZ) > day ? 0 : 24 * HOUR);
        busy.push({
          start: iso(morning + pick([6, 7, 8, 10]) * HOUR - 2 * HOUR),
          end: iso(morning + 14 * HOUR),
          ...(flag(0.7) ? { category: "work" as const } : { priority: "never" as const }),
        });
      }
      return { profileId: `p${n}`, name: `P${n}`, busy };
    });
    const p = profile();
    const rate = comfortRater({ participants, settings, profile: p, timeZone: TZ, now: NOW });
    add("comfort", { participants, settings, profile: p, dates: [date], scores: [null] }, [
      { comfort: rate(date), impact: impactOn(p, date, settings, TZ) },
    ]);
  }

  // Family days, Easter, the long weekends and sunset through two years.
  for (let i = 0; i < 80; i++) {
    const day = startOfDay(NOW + int(0, 730) * 24 * HOUR, TZ);
    const start = day + int(10, 20) * HOUR;
    const settings: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };
    const p: EventImpact = {
      v: 1,
      effects: [],
      runsLate: flag(0.3),
      strain: "light",
      recoveryDays: 0,
      outdoors: true,
      daylight: true,
      confidence: "high",
      reason: "",
    };
    const rate = comfortRater({ participants: [], settings, profile: p, timeZone: TZ, now: NOW });
    const date = { start: iso(start), end: iso(start + 3 * HOUR) };
    add(
      "day",
      { day, date, profile: p },
      { sunset: Math.floor(sunset(day, TZ) / 60_000), comfort: rate(date) },
    );
  }
  return cases;
}
