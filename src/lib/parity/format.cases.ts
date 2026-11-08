/** format.ts in Danish and English, for Format.swift. */
import type { Lang } from "@/i18n/locale";
import type { EventSettings } from "@/lib/eventSearch";
import {
  capitalize,
  dayLabel,
  formatClockMinutes,
  formatCountdown,
  formatDate,
  formatDaySpan,
  formatEventDate,
  formatHeadline,
  formatLongDate,
  formatLongSpan,
  formatLongSpanLines,
  formatMonthYear,
  formatTime,
  monthName,
  monthShortName,
  nameList,
  weekdayName,
  weekdayShortName,
} from "@/lib/format";
import { addDays, APP_TIME_ZONE, startOfDay } from "@/lib/zone";

import { caseBook, type ParityCase } from "./cases";

const LANGS: Lang[] = ["da", "en"];
const FIRST = Date.UTC(2025, 0, 1);
const LAST = Date.UTC(2031, 0, 1);
const WORDS = {
  scheduler: {
    timeRange: (a: string, b: string) => `RANGE ${a} ${b}`,
    tripTimes: (a: string, b: string) => `TRIP ${a} ${b}`,
  },
  common: { days: (n: number) => `DAYS ${n}` },
};

export function formatCases(): ParityCase[] {
  const { cases, add, int, pick } = caseBook(20261109);
  const instant = () => int(FIRST, LAST);
  const iso = () => new Date(instant()).toISOString();

  // Every month and every weekday by name, in both languages.
  for (const lang of LANGS) {
    for (let month = 0; month < 12; month++) {
      const ms = Date.UTC(2026, month, 15, 12);
      add("monthName", { ms, lang }, monthName(ms, lang));
      add("monthShortName", { ms, lang }, monthShortName(ms, lang));
      add(
        "formatMonthYear",
        { iso: new Date(ms).toISOString(), lang },
        formatMonthYear(new Date(ms).toISOString(), lang),
      );
    }
    for (let day = 0; day < 7; day++) {
      const ms = Date.UTC(2026, 5, 7 + day, 12);
      add("weekdayName", { ms, lang }, weekdayName(ms, lang));
      add("weekdayShortName", { ms, lang }, weekdayShortName(ms, lang));
    }
  }

  for (let i = 0; i < 250; i++) {
    const lang = pick(LANGS);
    const start = iso();
    const startMs = Date.parse(start);
    const later = new Date(startMs + int(30, 60 * 24 * 5) * 60_000).toISOString();
    const dayStart = startOfDay(startMs, APP_TIME_ZONE);
    const days = int(1, 16);
    const spanStart = new Date(dayStart).toISOString();
    const spanEnd = new Date(addDays(dayStart, days, APP_TIME_ZONE)).toISOString();
    const timeZone = pick([APP_TIME_ZONE, "America/New_York", "Asia/Tokyo", "Asia/Kolkata"]);

    add("dayLabel", { ms: startMs, lang }, dayLabel(startMs, lang));
    add("formatDate", { iso: start, lang, timeZone }, formatDate(start, lang, timeZone));
    add("formatTime", { iso: start, timeZone }, formatTime(start, timeZone));
    add("formatLongDate", { iso: start, lang }, formatLongDate(start, lang));
    add(
      "formatDaySpan",
      { start: spanStart, end: spanEnd, lang },
      formatDaySpan(spanStart, spanEnd, lang),
    );
    add(
      "formatLongSpanLines",
      { start: spanStart, end: spanEnd, lang },
      formatLongSpanLines(spanStart, spanEnd, lang),
    );
    add(
      "formatLongSpan",
      { start: spanStart, end: spanEnd, lang },
      formatLongSpan(spanStart, spanEnd, lang),
    );

    const kind = pick(["single", "trip", "vacation"] as const);
    const end = kind === "vacation" ? spanEnd : later;
    const first = kind === "vacation" ? spanStart : start;
    const date = { start: first, end };
    add("formatEventDate", { kind, start: first, end, lang }, formatEventDate(kind, date, lang));
    add(
      "formatHeadline",
      { kind, days, start: first, end, lang },
      formatHeadline({ kind, days } as unknown as EventSettings, date, lang, WORDS),
    );
  }

  for (const ms of [-5000, 0, 999, 1000, 59_000, 3_599_000, 86_399_999, 86_400_000, 200_000_000]) {
    add("formatCountdown", { ms }, formatCountdown(ms));
  }
  for (const minutes of [-90, 0, 59, 60, 1110, 1439, 1440, 1560, 3000]) {
    add("formatClockMinutes", { minutes }, formatClockMinutes(minutes));
  }
  for (const text of ["", "juni 2026", "ønske", "Allerede", "æble"]) {
    add("capitalize", { text }, capitalize(text));
  }
  for (const lang of LANGS) {
    for (const names of [
      [],
      ["Emilie"],
      ["Emilie", "Tessa"],
      ["A", "B", "C"],
      ["A", "B", "C", "D", "E"],
    ]) {
      add("nameList", { names, lang }, nameList(names, lang));
    }
  }
  return cases;
}
