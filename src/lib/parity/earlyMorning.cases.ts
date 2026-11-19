/** earlyMorning.ts and eventWarnings.ts, for EarlyMorning.swift and EventWarnings.swift (#282). */
import type { EventLabel } from "@/api/eventLabels";
import type { Messages } from "@/i18n/da";
import { edgeWarnings } from "@/lib/earlyMorning";
import type { DateImpact } from "@/lib/eventImpact";
import { clashSentence, importantClashes, type LabelledEvent } from "@/lib/eventWarnings";
import { EFFECTS } from "@/lib/eventVocabulary";
import { startOfDay } from "@/lib/zone";
import type { BusyInterval, Participant } from "@/types";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 11, 20, 8);
const HOUR = 3_600_000;
const TZ = "Europe/Copenhagen";
const iso = (ms: number) => new Date(ms).toISOString();

/** Placeholder words, so the cases test the logic, not the language. */
const EDGE_WORDS = {
  backToBack: {
    you: "YOU",
    oneYou: "B2B-YOU",
    one: (who: string) => `B2B-ONE ${who}`,
    many: (list: string) => `B2B-MANY ${list}`,
  },
  earlyMorning: {
    you: "YOU",
    oneYou: (time: string) => `EARLY-YOU ${time}`,
    one: (who: string, time: string) => `EARLY-ONE ${who} ${time}`,
    many: (list: string) => `EARLY-MANY ${list}`,
  },
  newYearsDay: "NEW-YEAR",
};
const CLASH_WORDS = {
  and: "AND",
  when: (n: number) => `WHEN${n}`,
  nightBefore: (what: string, when: string, avoid: string) => `NIGHT ${what} ${when} ${avoid}`,
  prepDayBefore: (what: string, when: string) => `PREPDAY ${what} ${when}`,
  prep: (what: string, when: string) => `PREP ${what} ${when}`,
  recovery: (what: string, when: string) => `RECOVER ${what} ${when}`,
  kinds: { exam: "EXAM", deadline: "DEADLINE", flight: "FLIGHT", wedding: "WEDDING" },
  avoid: { lateNight: "LATE", alcohol: "DRINK", travel: "TRAVEL", exercise: "SPORT" },
};

export function earlyMorningCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261127);
  const flag = (odds: number) => random() < odds;

  for (let i = 0; i < 100; i++) {
    const day = startOfDay(NOW + int(0, 20) * 24 * HOUR, TZ);
    const start = day + int(16, 22) * HOUR + pick([0, 30]) * 60_000;
    const end = start + pick([2, 3, 4, 5, 7]) * HOUR;
    const slot = { start: iso(start), end: iso(end) };
    const participants: Participant[] = Array.from({ length: int(1, 4) }, (_, n) => {
      const busy: BusyInterval[] = [];
      if (flag(0.4)) busy.push({ start: iso(start - 2 * HOUR), end: iso(start) });
      if (flag(0.6)) {
        const next = startOfDay(end, TZ) + (startOfDay(end, TZ) > day ? 0 : 24 * HOUR);
        const at = next + pick([6, 7, 8, 9, 10, 11]) * HOUR + pick([0, 30]) * 60_000;
        busy.push({
          start: iso(at),
          end: iso(at + 4 * HOUR),
          ...(flag(0.1) ? { holiday: true } : {}),
        });
      }
      if (flag(0.2)) busy.push({ start: iso(day + 24 * HOUR), end: iso(day + 48 * HOUR) });
      return { profileId: `p${n}`, name: `P${n}`, busy };
    });
    const you = flag(0.5) ? "p0" : null;
    const lang = pick(["da", "en"] as const);
    add(
      "edge",
      { participants, slot, you, lang },
      edgeWarnings(participants, slot, TZ, you, lang, EDGE_WORDS),
    );
  }

  for (let i = 0; i < 100; i++) {
    const start = NOW + int(0, 10) * 24 * HOUR + int(-4, 14) * HOUR;
    const impact: DateImpact = {
      profiled: flag(0.7),
      effects: EFFECTS.filter(() => flag(0.3)),
      strain: pick([null, "none", "light", "moderate", "heavy"] as const),
      recoveryDays: int(0, 2),
      outdoors: false,
      daylight: false,
      start,
      end: start + pick([1, 2, 3, 5, 24, 48]) * HOUR,
    };
    const mine: LabelledEvent[] = Array.from({ length: int(0, 6) }, (_, n) => {
      const at = impact.end + int(-10, 100) * HOUR;
      const label: EventLabel = {
        kind: pick(["exam", "deadline", "flight", "wedding"] as const),
        importance: pick(["low", "normal", "high", "critical"] as const),
        prepDays: int(0, 3),
        avoidBefore: EFFECTS.filter(() => flag(0.4)),
        recoveryDays: 0,
        strain: "light",
        confidence: "high",
        reason: "",
      };
      return { title: `E${n}`, start: at, end: at + 2 * HOUR, allDay: false, label };
    }).sort((a, b) => a.start - b.start);
    const clashes = importantClashes(impact, mine, TZ);
    add(
      "clashes",
      { impact, mine },
      {
        clashes,
        sentences: clashes.map((c) =>
          clashSentence(c, CLASH_WORDS as unknown as Messages["importantClash"]),
        ),
      },
    );
  }
  return cases;
}
