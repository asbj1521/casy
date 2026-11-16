/** calendarOverview.ts's list rules, calendarTour.ts, syncedAgo and the Apple password check, for Calendars.swift (#200). */
import { syncedAgo } from "@/lib/accountSummary";
import { looksLikeAppSpecificPassword } from "@/lib/appleCredentials";
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
  return cases;
}
