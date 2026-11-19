/** availability.ts, for Availability.swift (#282). */
import {
  findBestDaySpan,
  findMeetingSlot,
  findVacationSuggestions,
  findWeeklySpan,
  isHardBlock,
  isSoftBlock,
  spanAvailability,
} from "@/lib/availability";
import type { BusyInterval, MeetingSearch, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

/** Wednesday 7 October 2026, 08:00 UTC: the fake world's now. */
const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

export function availabilityCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261119);
  const flag = (odds: number) => random() < odds;

  /** A block: an evening plan, a workday, a day away, a long trip, now and then malformed. */
  const block = (): BusyInterval => {
    const kind = pick(["short", "short", "work", "work", "school", "away", "trip"] as const);
    const day = int(-2, 60);
    const startHour =
      kind === "work" || kind === "school" ? int(7, 9) : kind === "short" ? int(8, 21) : 0;
    const start = NOW + day * 24 * HOUR + (startHour - 8) * HOUR + pick([0, 0, 30]) * 60_000;
    const hours =
      kind === "short"
        ? int(1, 4)
        : kind === "work" || kind === "school"
          ? int(6, 11)
          : kind === "away"
            ? 24
            : int(2, 6) * 24;
    const b: BusyInterval = { start: iso(start), end: iso(start + hours * HOUR) };
    if (flag(0.02)) b.end = b.start;
    if (kind === "work") b.category = "work";
    if (kind === "school") b.category = "school";
    if (kind === "short" && flag(0.3))
      b.category = pick(["social", "health", "travel", "personal", "family"]);
    if (flag(0.2)) b.priority = pick(["skip", "never", "normal"]);
    return b;
  };
  const person = (n: number): Participant => ({
    profileId: `p${n}`,
    name: `Person ${n}`,
    busy: Array.from({ length: int(0, 10) }, block),
  });
  const people = () => Array.from({ length: int(1, 5) }, (_, n) => person(n));
  const zone = () => pick(["Europe/Copenhagen", "Europe/Copenhagen", "America/New_York"]);
  const range = () => {
    const from = NOW + int(-24, 72) * HOUR;
    return { searchStart: iso(from), searchEnd: iso(from + int(3, 70) * 24 * HOUR) };
  };

  for (let i = 0; i < 220; i++) {
    const participants = people();
    const earliest = flag(0.6) ? int(6, 18) + pick([0, 0.5]) : undefined;
    const latest = earliest !== undefined ? Math.min(28, earliest + int(2, 10)) : undefined;
    const constraints: MeetingSearch["constraints"] = {};
    if (earliest !== undefined) constraints.earliestHour = earliest;
    if (latest !== undefined) constraints.latestHour = latest;
    if (flag(0.4)) constraints.allowedDays = [0, 1, 2, 3, 4, 5, 6].filter(() => flag(0.6));
    if (flag(0.5)) constraints.startStepMinutes = pick([15, 30, 60]);
    if (flag(0.3) && earliest !== undefined) constraints.preferredHour = earliest + int(0, 3);
    const search: MeetingSearch = {
      participants,
      durationMinutes: pick([30, 60, 90, 120, 180, 0]),
      ...range(),
      timeZone: zone(),
      ...(flag(0.5) ? { constraints } : {}),
      ...(flag(0.35) ? { quorum: int(1, participants.length) } : {}),
    };
    add("findMeetingSlot", { search }, findMeetingSlot(search));
  }

  // Busy groups: evenings taken for weeks by what some would skip, and
  // workdays all through, so skipping wins a meeting and spans need time off.
  const busyPerson = (n: number): Participant => {
    const busy: BusyInterval[] = [];
    const nights = int(9, 20);
    for (let d = 0; d < nights; d++) {
      const start = NOW + d * 24 * HOUR + int(6, 7) * HOUR;
      busy.push({
        start: iso(start),
        end: iso(start + int(6, 8) * HOUR),
        ...(flag(0.9) ? { priority: "skip" as const } : {}),
      });
    }
    for (let d = 0; d < 32; d++) {
      const day = NOW + d * 24 * HOUR;
      const dow = new Date(day).getUTCDay();
      if (dow === 0 || dow === 6 || flag(0.15)) continue;
      busy.push({
        start: iso(day - HOUR + int(0, 1) * HOUR),
        end: iso(day + int(6, 10) * HOUR),
        category: flag(0.8) ? "work" : "school",
      });
    }
    if (flag(0.5)) {
      const away = NOW + int(5, 40) * 24 * HOUR;
      busy.push({ start: iso(away), end: iso(away + int(1, 4) * 24 * HOUR), category: "travel" });
    }
    return { profileId: `b${n}`, name: `Busy ${n}`, busy };
  };
  for (let i = 0; i < 36; i++) {
    const participants = Array.from({ length: int(2, 3) }, (_, n) => busyPerson(n));
    const timeZone = "Europe/Copenhagen";
    const searchStart = iso(NOW);
    const searchEnd = iso(NOW + int(20, 34) * 24 * HOUR);
    const search: MeetingSearch = {
      participants,
      durationMinutes: pick([60, 120, 180]),
      searchStart,
      searchEnd,
      timeZone,
      constraints: { earliestHour: 17, latestHour: 23, startStepMinutes: 30 },
      ...(flag(0.3) ? { quorum: participants.length - 1 } : {}),
    };
    add("findMeetingSlot", { search }, findMeetingSlot(search));
    const days = int(2, 8);
    add(
      "findBestDaySpan",
      { participants, days, searchStart, searchEnd, timeZone },
      findBestDaySpan(participants, days, searchStart, searchEnd, timeZone),
    );
    add(
      "findVacationSuggestions",
      { participants, days, searchStart, searchEnd, timeZone },
      findVacationSuggestions(participants, days, searchStart, searchEnd, timeZone),
    );
    const shape = { anchorDow: pick([4, 5]), spanDays: 3, startHour: pick([12, 17]), endHour: 21 };
    add(
      "findWeeklySpan",
      { participants, shape, searchStart, searchEnd, timeZone },
      findWeeklySpan(participants, shape, searchStart, searchEnd, timeZone),
    );
  }

  for (let i = 0; i < 90; i++) {
    const participants = people();
    const days = int(1, 9);
    const r = range();
    const timeZone = zone();
    add(
      "findBestDaySpan",
      { participants, days, ...r, timeZone },
      findBestDaySpan(participants, days, r.searchStart, r.searchEnd, timeZone),
    );
    add(
      "findVacationSuggestions",
      { participants, days, ...r, timeZone },
      findVacationSuggestions(participants, days, r.searchStart, r.searchEnd, timeZone),
    );
  }

  for (let i = 0; i < 80; i++) {
    const participants = people();
    const shape = {
      anchorDow: int(0, 6),
      spanDays: int(1, 4),
      startHour: pick([8, 12, 16, 17, 17.5]),
      endHour: pick([12, 18, 21, 22]),
    };
    const r = range();
    const timeZone = zone();
    add(
      "findWeeklySpan",
      { participants, shape, ...r, timeZone },
      findWeeklySpan(participants, shape, r.searchStart, r.searchEnd, timeZone),
    );
  }

  for (let i = 0; i < 60; i++) {
    const participants = people();
    const start = NOW + int(0, 40) * 24 * HOUR;
    const end = start + int(1, 6) * 24 * HOUR;
    add(
      "spanAvailability",
      { participants, start, end },
      {
        ...spanAvailability(participants, start, end),
        hard: participants.map((p) => p.busy.map(isHardBlock)),
        soft: participants.map((p) => p.busy.map(isSoftBlock)),
      },
    );
  }
  return cases;
}
