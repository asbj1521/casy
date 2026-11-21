/** paperPile.ts and comfortNotes.ts, for PaperPile.swift (#282). */
import { comfortNotes } from "@/lib/comfortNotes";
import type { Penalty, Rule } from "@/lib/dateComfort";
import type { EdgeWarning } from "@/lib/earlyMorning";
import type { EventSettings } from "@/lib/eventSearch";
import {
  buildPile,
  candidateMonth,
  checkTimes,
  jostle,
  layerAlpha,
  liveOrder,
  pileTimeline,
  rankOrder,
  sheetTilt,
  type RankedFacts,
} from "@/lib/paperPile";
import { startOfMonth } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, roundedDeep, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

const WORDS = {
  you: "Du",
  tightBefore: (who: string) => `${who} før`,
  tightAfter: (who: string) => `${who} efter`,
  squeezed: (who: string) => `${who} klemt`,
  earlyAfterLate: (who: string) => `${who} tidligt`,
  schoolNight: "skole",
  afterDark: "mørke",
  familyDay: "familie",
  longWeekend: "lang weekend",
  soon: "snart",
  farAhead: "langt ude",
};

const RULES: Rule[] = [
  "tightBefore",
  "tightAfter",
  "sandwiched",
  "earlyAfterLate",
  "schoolNight",
  "afterDark",
  "dayOfYear",
  "notice",
  "farAhead",
];

export function paperPileCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261125);
  const flag = (odds: number) => random() < odds;

  const block = (): BusyInterval => {
    const start = NOW + int(-5 * 24, 90 * 24) * HOUR;
    const b: BusyInterval = { start: iso(start), end: iso(start + pick([1, 3, 9, 24, 50]) * HOUR) };
    if (flag(0.3)) b.category = pick(["work", "school", "social"]);
    if (flag(0.2)) b.priority = pick(["skip", "never"]);
    return b;
  };

  for (let i = 0; i < 50; i++) {
    const participants: Participant[] = Array.from({ length: int(1, 5) }, (_, n) => ({
      profileId: `p${n}`,
      name: `P${n}`,
      busy: Array.from({ length: int(0, 40) }, block),
    }));
    const kind = pick(["single", "single", "trip", "vacation"] as const);
    const search: EventSettings =
      kind === "single"
        ? { kind, durationMinutes: pick([60, 120, 180]), startHour: int(9, 20) }
        : kind === "trip"
          ? {
              kind,
              shape: { anchorDow: int(0, 6), spanDays: int(1, 4), startHour: 17, endHour: 21 },
            }
          : { kind, days: int(2, 7) };
    if (flag(0.3)) {
      search.people = {
        members: participants.map((p) => p.profileId),
        optional: flag(0.5) ? ["p0"] : [],
      };
    }
    const offset = int(0, 3);
    const first = startOfMonth(NOW, TZ, offset);
    const window = {
      start: iso(NOW + int(0, 10) * 24 * HOUR),
      end: iso(startOfMonth(NOW, TZ, int(1, 6))),
    };
    const you = pick(["p0", "p1", null]);
    // The month's local year and month: the 1st's midnight is the day before in UTC.
    const local = new Date(first + 12 * HOUR);
    add(
      "pile",
      {
        participants,
        search,
        you,
        year: local.getUTCFullYear(),
        month: local.getUTCMonth(),
        window,
      },
      buildPile(participants, search, you, local.getUTCFullYear(), local.getUTCMonth(), {
        timeZone: TZ,
        todayMs: NOW,
        windowEndMs: Date.parse(window.end),
        locale: "da-DK",
        window,
      }),
    );
    const starts = Array.from({ length: int(0, 6) }, () => iso(NOW + int(0, 120) * 24 * HOUR));
    add("month", { starts, fallback: window.start }, candidateMonth(starts, window.start, TZ));
  }

  for (let i = 0; i < 40; i++) {
    const others = int(0, 9);
    const dates = int(0, 8);
    const start = pick([0.6, 0.12, 0]);
    add("timeline", { others, dates, start }, pileTimeline(others, dates, start));
    add("checks", { dates }, checkTimes(dates));
    const landed = Array.from({ length: others }, () => int(0, others + 1));
    add(
      "layer",
      { others, landed },
      {
        alpha: layerAlpha(others),
        tilt: sheetTilt(others),
        jostle: landed.map((n, k) => jostle(k, n)),
      },
    );
  }

  for (let i = 0; i < 60; i++) {
    const facts: RankedFacts[] = Array.from({ length: int(1, 8) }, () => ({
      pickedAt: flag(0.5) ? int(0, 5) : null,
      conflicts: int(0, 2),
      cost: pick([0, 0, 1.5, 4, 10.25]),
      warnings: int(0, 2),
      start: NOW + int(0, 60) * 24 * HOUR,
    }));
    const priority = pick(["hassle", "soon"] as const);
    const ranked = rankOrder(facts, priority);
    const offered = facts.map((f) => f.pickedAt !== null);
    const checked = int(0, facts.length);
    add(
      "rank",
      { facts, priority, checked },
      { ranked, live: liveOrder(ranked, checked, offered) },
    );
  }

  for (let i = 0; i < 80; i++) {
    const penalties: Penalty[] = Array.from({ length: int(0, 8) }, () => {
      const rule = pick(RULES);
      const p: Penalty = { rule, points: pick([-2, 0.5, 1, 2, 3, 4, 10]) };
      if (
        ["tightBefore", "tightAfter", "sandwiched", "earlyAfterLate"].includes(rule) &&
        flag(0.8)
      ) {
        p.who = pick(["p0", "p1", "p2"]);
      }
      return p;
    });
    const warnings: EdgeWarning[] | null = flag(0.3)
      ? null
      : (["newYearsDay", "backToBack", "earlyMorning"] as const)
          .filter(() => flag(0.3))
          .map((kind) => ({ kind, text: kind }));
    const youId = pick(["p0", "p1", null]);
    add(
      "comfortNotes",
      { penalties, warnings, youId },
      comfortNotes(penalties, {
        nameOf: (id) => `Navn ${id}`,
        youId,
        lang: "da",
        words: WORDS,
        warnings,
      }),
    );
  }
  // The timings and layers are built with `**`: rounded, so every engine writes the same.
  return cases.map((c) => ({ ...c, output: roundedDeep(c.output) }));
}
