/** periodText.ts and viewerTime.ts, for Period.swift. */
import type { Messages } from "@/i18n/da";
import { LOCALE, type Lang } from "@/i18n/locale";
import { periodText } from "@/lib/periodText";
import type { Period } from "@/lib/scheduler";
import { yourTime } from "@/lib/viewerTime";
import { addDays, APP_TIME_ZONE, startOfMonth, wallTime } from "@/lib/zone";

import { caseBook, type ParityCase } from "./cases";

const WORDS = {
  scheduler: {
    period: {
      any: "ANY",
      one: (m: string) => `ONE ${m}`,
      range: (a: string, b: string) => `RANGE ${a}|${b}`,
      day: (d: string) => `DAY ${d}`,
      until: (d: string) => `UNTIL ${d}`,
    },
  },
} as unknown as Messages;
const LANGS: Lang[] = ["da", "en"];
const iso = (ms: number) => new Date(ms).toISOString();

export function periodCases(): ParityCase[] {
  const { cases, add, int, pick } = caseBook(20261111);
  const say = (value: Period | null, lang: Lang, now: number) =>
    add("periodText", { value, lang, now }, periodText(value, LOCALE[lang], WORDS, now));

  for (let i = 0; i < 160; i++) {
    const lang = pick(LANGS);
    const now = wallTime(2026, int(0, 11), int(1, 28), int(0, 23), APP_TIME_ZONE);
    const month = startOfMonth(now, APP_TIME_ZONE, int(0, 13));
    const other = startOfMonth(month, APP_TIME_ZONE, int(1, 5));
    const day = addDays(now, int(-3, 90), APP_TIME_ZONE);
    const dayIso = iso(wallTime(2026, 0, 1, 0, APP_TIME_ZONE) + 0);
    say(null, lang, now);
    say({ from: iso(month), to: iso(month) }, lang, now);
    say({ from: iso(month), to: iso(other) }, lang, now);
    say({ from: iso(day), to: iso(day), days: true }, lang, now);
    say(
      { from: iso(day), to: iso(addDays(day, int(1, 40), APP_TIME_ZONE)), days: true },
      lang,
      now,
    );
    say({ from: dayIso, to: iso(addDays(day, 3, APP_TIME_ZONE)), days: true }, lang, now);
  }

  const zones = ["Asia/Tokyo", "America/New_York", "Europe/Oslo", "Europe/London", APP_TIME_ZONE];
  for (let i = 0; i < 200; i++) {
    const lang = pick(LANGS);
    const kind = pick(["single", "trip", "vacation"] as const);
    const startMs = Date.UTC(int(2025, 2030), int(0, 11), int(1, 28), int(0, 23), pick([0, 30]));
    const start = iso(startMs);
    const end = iso(startMs + int(1, 80) * 3_600_000);
    const viewerZone = pick(zones);
    add(
      "yourTime",
      { kind, start, end, lang, viewerZone },
      yourTime(kind, { start, end }, lang, viewerZone),
    );
  }
  return cases;
}
