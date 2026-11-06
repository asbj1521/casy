/**
 * The guided calendar setup (#221): the pure part. Which calendars come, the
 * slider's four stops as they map onto what a calendar stores, what a card
 * changed, and which calendars still want a look.
 */
import type { CalendarChange } from "@/api/calendars";
import type { OverviewCalendar } from "@/lib/calendarOverview";
import { readStored, writeStored } from "@/lib/storage";
import type { CalendarPriority, CalendarPurpose } from "@/types";

/**
 * The slider, lowest first. Not a scale: a calendar either counts or doesn't
 * (`included`), and if it counts it has one of three fixed priorities, so the
 * slider snaps to these and promises no more than they do.
 */
export const TOUR_STOPS = ["off", "skip", "normal", "never"] as const;
export type TourStop = (typeof TOUR_STOPS)[number];

/** What a card says about one calendar. */
export interface TourChoice {
  purpose: CalendarPurpose | null;
  categoryName: string | null;
  stop: TourStop;
}

/** The calendars it goes through: every real one, those switched off too; never Holidays or Casy's own. */
export function tourCalendars(calendars: OverviewCalendar[]): OverviewCalendar[] {
  return calendars.filter((c) => c.provider !== "builtin");
}

export function choiceOf(c: OverviewCalendar): TourChoice {
  return {
    purpose: c.purpose,
    categoryName: c.categoryName ?? null,
    stop: c.included ? (c.priority satisfies CalendarPriority) : "off",
  };
}

/**
 * What to save for a card. Confirming Casy's guess saves it too, though nothing
 * changed: it is then the person's own, and the AI leaves it alone. Having no
 * category and leaving it so saves nothing, so a calendar that hasn't been
 * sorted yet can still be.
 */
export function changesFrom(c: OverviewCalendar, choice: TourChoice): CalendarChange[] {
  const changes: CalendarChange[] = [];
  const sameCategory =
    choice.purpose === c.purpose && choice.categoryName === (c.categoryName ?? null);
  if (!sameCategory || (c.purposeGuessed && choice.purpose !== null)) {
    changes.push(
      choice.categoryName
        ? { purpose: choice.purpose, categoryName: choice.categoryName }
        : { purpose: choice.purpose },
    );
  }
  if (choice.stop === "off") {
    if (c.included) changes.push({ included: false });
  } else {
    if (!c.included) changes.push({ included: true });
    if (choice.stop !== c.priority) changes.push({ priority: choice.stop });
  }
  return changes;
}

/**
 * White on a calendar's colour ("r, g, b") as long as it reads at the 3:1 asked
 * of large text, as Apple's blue does; black on anything lighter, as its yellow
 * and green need.
 */
export function textOn(rgb: string): "#ffffff" | "#1c1c1e" {
  const [r, g, b] = rgb.split(",").map((part) => {
    const c = Number(part) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.3 ? "#1c1c1e" : "#ffffff";
}

const seenKey = (userId: string) => `casy-calendar-tour-seen:${userId}`;

/** The calendars this person has been through, on this phone. */
export function readTourSeen(userId: string): Set<string> {
  try {
    const ids: unknown = JSON.parse(readStored(seenKey(userId)) ?? "[]");
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set();
  }
}

export function rememberTourSeen(userId: string, seen: ReadonlySet<string>): void {
  writeStored(seenKey(userId), JSON.stringify([...seen]));
}

/**
 * The calendars still wanting a look, which the Kalendere button counts: counting,
 * and with no category or only Casy's guess. One gone through and left without a
 * category isn't asked about again (`seen`), so the count can always reach nothing,
 * and a calendar connected later brings it back.
 */
export function unsortedCalendars(
  calendars: OverviewCalendar[],
  seen: ReadonlySet<string>,
): OverviewCalendar[] {
  return tourCalendars(calendars).filter(
    (c) => c.included && (c.purpose === null || c.purposeGuessed) && !seen.has(c.id),
  );
}

/** What the tour goes through: only those wanting a look, or with none left, all of them. */
export function tourSteps(
  calendars: OverviewCalendar[],
  seen: ReadonlySet<string>,
): OverviewCalendar[] {
  const unsorted = unsortedCalendars(calendars, seen);
  return unsorted.length > 0 ? unsorted : tourCalendars(calendars);
}
