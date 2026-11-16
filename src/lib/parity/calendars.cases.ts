/** calendarOverview.ts's list rules, calendarTour.ts, syncedAgo and the Apple password check, for Calendars.swift (#200). */
import { syncedAgo } from "@/lib/accountSummary";
import { looksLikeAppSpecificPassword } from "@/lib/appleCredentials";
import { entryWhen, type CasyEntry } from "@/lib/casyEntries";
import {
  EMPTY_TRANSCRIPT,
  hearSpeech,
  transcriptText,
  type Transcript,
} from "@/lib/speechTranscript";
import { LOCALE } from "@/i18n/locale";
import { stretchShape, type PrimeDate } from "@/lib/primeDates";
import { dayOptions, type Leg } from "@/lib/trips";
import { cityName } from "@/lib/tripView";
import { addDays, startOfDay } from "@/lib/zone";
import {
  categoryLabel,
  groupCalendarsByBrand,
  groupVisibility,
  holidaysInYearAhead,
  ownCategories,
  type OverviewCalendar,
} from "@/lib/calendarOverview";
import {
  changesFrom,
  choiceOf,
  textOn,
  TOUR_STOPS,
  tourSteps,
  unsortedCalendars,
  type TourChoice,
} from "@/lib/calendarTour";
import type { CalendarPurpose } from "@/types";

import { caseBook, type ParityCase } from "./cases";

const TZ = "Europe/Copenhagen";
const NAMES = [
  "Fodbold",
  "fodbold",
  "Ærø",
  "Åben",
  "kor",
  "Kor",
  "Zumba",
  "øvelse",
  "Band 2",
  "band 10",
  "a",
  "B",
];
const PURPOSES = [null, null, "work", "school", "personal", "other"] as const;

export function calendarsCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261116);
  const flag = (odds: number) => random() < odds;

  const calendar = (n: number): OverviewCalendar => {
    const purpose = pick(PURPOSES);
    return {
      id: `cal${n}`,
      name: `Cal ${n}`,
      originalName: null,
      renamed: false,
      writable: flag(0.5),
      purpose,
      ...(flag(0.3) && purpose && { categoryName: pick(NAMES) }),
      ...(flag(0.4) && { purposeGuessed: flag(0.5) }),
      priority: pick(["skip", "normal", "never"] as const),
      included: flag(0.75),
      total: int(0, 50),
      provider: pick([
        "google",
        "apple",
        "device",
        "ics",
        "outlook",
        "builtin",
        "caldav",
      ] as never[]),
      account: flag(0.5) ? pick(["mia@icloud.com", "mia@example.com"]) : null,
      connectionId: pick(["c1", "c2"]),
    };
  };
  const calendars = () => Array.from({ length: int(0, 9) }, (_, n) => calendar(n));

  for (let i = 0; i < 60; i++) {
    const list = calendars();
    const groups = groupCalendarsByBrand(list);
    add("groupCalendarsByBrand", { calendars: list }, groups);
    for (const group of groups) add("groupVisibility", { group }, groupVisibility(group));
    add("ownCategories", { calendars: list }, ownCategories(list));
    const seen = list.filter(() => flag(0.3)).map((c) => c.id);
    add("unsortedCalendars", { calendars: list, seen }, unsortedCalendars(list, new Set(seen)));
    add("tourSteps", { calendars: list, seen }, tourSteps(list, new Set(seen)));
  }

  const words = { work: "W", school: "S", personal: "P", other: "O" } as Record<
    CalendarPurpose,
    string
  >;
  for (let i = 0; i < 30; i++) {
    const c = calendar(i);
    add(
      "categoryLabel",
      { purpose: c.purpose, categoryName: c.categoryName ?? null },
      categoryLabel(c, words, "none"),
    );
  }

  for (let i = 0; i < 80; i++) {
    const c = calendar(i);
    add("choiceOf", { calendar: c }, choiceOf(c));
    const purpose = pick(PURPOSES);
    const choice: TourChoice = flag(0.3)
      ? choiceOf(c)
      : {
          purpose,
          categoryName: purpose && flag(0.3) ? pick(NAMES) : null,
          stop: pick([...TOUR_STOPS]),
        };
    add("changesFrom", { calendar: c, choice }, changesFrom(c, choice));
  }

  for (let i = 0; i < 30; i++) {
    const rgb = `${int(0, 255)}, ${int(0, 255)}, ${int(0, 255)}`;
    add("textOn", { rgb }, textOn(rgb));
  }

  const NOW = Date.UTC(2026, 10, 16, 10, 30);
  for (let i = 0; i < 40; i++) {
    const iso = flag(0.1)
      ? null
      : new Date(NOW - int(-5, 60 * 24 * 9) * 60_000 - int(0, 59_999)).toISOString();
    const out = syncedAgo(iso, NOW, {
      justNow: "now",
      minutes: (n) => `m${n}`,
      hours: (n) => `h${n}`,
      days: (n) => `d${n}`,
    });
    add("syncedAgo", { iso, now: NOW }, out);
  }

  for (const value of [
    "abcd-efgh-ijkl-mnop",
    "ABCDEFGHIJKLMNOP",
    "  abcd-efgh-ijkl-mnop ",
    "abcd-efgh-ijkl-mno",
    "abcd-efgh-ijkl-mnop-",
    "abcdefghijklmnopq",
    "abcd efgh ijkl mnop",
    "abc1-efgh-ijkl-mnop",
    "MyPassword123!",
    "",
    "æbcd-efgh-ijkl-mnop",
  ]) {
    add("looksLikeAppSpecificPassword", { value }, looksLikeAppSpecificPassword(value));
  }

  for (let i = 0; i < 20; i++) {
    const now = Date.UTC(2025, 0, 1) + int(0, 900) * 86_400_000 + int(0, 86_399) * 1000;
    add("holidaysInYearAhead", { timeZone: TZ, now }, holidaysInYearAhead(TZ, now));
  }
  // Around the autumn's clock change, whole days, an evening, and across midnight.
  for (let i = 0; i < 60; i++) {
    const day = startOfDay(Date.UTC(2026, 9, 20) + int(0, 14) * 86_400_000, TZ);
    const allDay = flag(0.5);
    const start = allDay ? day : day + int(0, 23 * 4) * 900_000;
    const end = allDay ? addDays(day, int(1, 9), TZ) : start + int(1, 40) * 900_000;
    const entry: CasyEntry = {
      kind: pick(["away", "busy"] as const),
      label: "Rejse",
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay,
    };
    for (const lang of ["da", "en"] as const)
      add("entryWhen", { entry, lang }, entryWhen(entry, lang));
  }
  // speechTranscript.ts: what is heard across a pause (Tilføj til kalender's microphone).
  const SAID = [
    "jeg",
    "rejser",
    "fra",
    "den",
    "12.",
    "til",
    "19.",
    "oktober",
    "og",
    "har",
    "kursus",
  ];
  for (let i = 0; i < 30; i++) {
    let transcript: Transcript = EMPTY_TRANSCRIPT;
    const heard: string[] = [];
    let words = int(1, 6);
    for (let step = 0; step < 6; step++) {
      // Mostly growing; now and then a correction, or a start-over after a pause.
      words = flag(0.25) ? int(1, 2) : Math.min(SAID.length, words + int(0, 2));
      const text = SAID.slice(0, words).join(" ");
      heard.push(text);
      transcript = hearSpeech(transcript, text);
    }
    add("hearSpeech", { heard }, { ...transcript, text: transcriptText(transcript) });
  }
  // trips.ts and tripView.ts, for the trip sheet: a city's name, the days a question offers.
  const CITY_KEYS = [
    "copenhagen",
    "oslo",
    "new york",
    "the hague",
    "'s-hertogenbosch",
    "aarhus",
    "rome",
  ];
  const leg = (n: number): Leg => {
    const from = pick(CITY_KEYS);
    const to = pick(CITY_KEYS);
    const start = Date.UTC(2026, 9, 10) + int(0, 40) * 86_400_000;
    return {
      id: `leg${n}`,
      mode: pick(["flight", "train", "bus"] as const),
      from,
      to,
      start,
      end: start + int(1, 10) * 3_600_000,
      count: 1,
      ...(flag(0.6) && {
        names: {
          from: flag(0.2) ? from : from.toUpperCase(),
          to: flag(0.2) ? to : `${to[0].toUpperCase()}${to.slice(1)}`,
        },
      }),
    };
  };
  for (let i = 0; i < 30; i++) {
    const legs = Array.from({ length: int(0, 4) }, (_, n) => leg(n));
    const key = pick(CITY_KEYS);
    for (const lang of ["da", "en"] as const) {
      add("cityName", { key, legs, lang }, cityName(key, legs, lang));
    }
  }
  const TRIP_NOW = Date.UTC(2026, 9, 20, 9);
  for (let i = 0; i < 30; i++) {
    const at = TRIP_NOW + int(-20, 20) * 86_400_000 + int(0, 23) * 3_600_000;
    const bound = flag(0.3) ? null : at + int(-10, 70) * 86_400_000;
    const question = flag(0.5)
      ? { kind: "return" as const, id: "q", legs: [], earliest: at, latest: bound }
      : { kind: "outbound" as const, id: "q", legs: [], earliest: bound, latest: at };
    add("dayOptions", { question, now: TRIP_NOW }, dayOptions(question, TRIP_NOW));
  }
  // primeDates.ts, for Tid til hinanden's sheet: how a stretch is said, and everyone named.
  for (let i = 0; i < 40; i++) {
    const day = startOfDay(Date.UTC(2026, 9, 20) + int(0, 14) * 86_400_000, TZ);
    const hour = (h: number) => day + h * 3_600_000;
    const prime: PrimeDate = {
      groupId: "g",
      kind: flag(0.2) ? "weekend" : "hours",
      day,
      start: pick([day, hour(10), hour(14), hour(17)]),
      end: pick([hour(22), hour(20), hour(23)]),
      value: 1,
    };
    add("stretchShape", { prime }, stretchShape(prime, TZ));
  }
  const PEOPLE = ["Ana", "Bo", "Cille", "Dan", "dig"];
  for (let n = 0; n <= PEOPLE.length; n++) {
    for (const lang of ["da", "en"] as const) {
      const names = PEOPLE.slice(0, n);
      add(
        "everyone",
        { names, lang },
        new Intl.ListFormat(LOCALE[lang], { type: "conjunction" }).format(names),
      );
    }
  }
  return cases;
}
