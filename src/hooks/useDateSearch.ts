import { useMemo } from "react";

import {
  findVacationSuggestions,
  type MultiDayResult,
  type VacationSuggestion,
} from "@/lib/availability";
import type { Step } from "@/lib/answerSteps";
import { findEventSlot, SEARCH_WINDOW, type EventSettings } from "@/lib/eventSearch";
import { laterSlots, type FoundDate } from "@/lib/scheduler";
import { addDays, APP_TIME_ZONE, dayOf } from "@/lib/zone";
import type { Participant } from "@/types";

const TZ = APP_TIME_ZONE;

/** Today as a local-midnight ISO, from when the page was loaded. Never searched before. */
export const TODAY = dayOf(new Date().toISOString(), TZ);

/** How many later dates the "Også muligt" row offers. */
const LATER_COUNT = 3;

export interface DateSearch {
  /** The first date that works from the step on screen, and what it costs whom. */
  found: MultiDayResult | null;
  /** Ways to make a holiday that doesn't fit cleanly work, such as a shorter stay. */
  suggestions: VacationSuggestion[];
  /** The next few dates after the one found, unless there are suggestions instead. */
  later: FoundDate[];
  /** The local day (a local-midnight ISO) the date found starts on. */
  firstDay: string | null;
  /** Every local day it covers, for the chart. */
  days: ReadonlySet<string>;
}

/**
 * The scheduling page's answer: the first date from `step` that works for
 * `participants`, the workarounds for a holiday that doesn't fit, the dates
 * after it, and the days it covers. All pure and quick (a few to a few dozen
 * ms), so it simply follows its inputs. `participants` is null while there is
 * nothing to search: a group still loading, failed, or with no calendars,
 * where "everyone" would otherwise be free today.
 */
export function useDateSearch(
  participants: Participant[] | null,
  search: EventSettings,
  step: Step,
): DateSearch {
  const { from, day: pickedDay } = step;

  const found = useMemo(
    () => (participants ? findAnswer(participants, search, { from, day: pickedDay }) : null),
    [participants, search, from, pickedDay],
  );

  // "6 days works for everyone if you leave after work Friday" and the like.
  const suggestions = useMemo(() => {
    if (search.kind !== "vacation" || !participants || !found) return [];
    if (found.slot && found.conflicts.length === 0) return [];
    return findVacationSuggestions(participants, search.days, from ?? TODAY, SEARCH_WINDOW.end, TZ);
  }, [participants, search, found, from]);

  const slot = found?.slot ?? null;
  const later = useMemo(() => {
    if (!participants || !slot || suggestions.length > 0) return [];
    return laterSlots(participants, search, slot.start, LATER_COUNT, SEARCH_WINDOW.end, TZ);
  }, [participants, search, slot, suggestions]);

  const firstDay = slot ? dayOf(slot.start, TZ) : null;
  const spanDays =
    search.kind === "vacation" ? search.days : search.kind === "trip" ? search.shape.spanDays : 1;
  const days = useMemo(() => {
    const set = new Set<string>();
    if (!firstDay) return set;
    for (let i = 0; i < spanDays; i++) {
      set.add(new Date(addDays(Date.parse(firstDay), i, TZ)).toISOString());
    }
    return set;
  }, [firstDay, spanDays]);

  return { found, suggestions, later, firstDay, days };
}

/**
 * The date the page shows for `step`: the first that works for `participants`,
 * and what it costs whom. Also run on its own, with fresh busy times, to check
 * a date still holds before it is sent (FindDate's suggest), so the check and
 * the page can never disagree about what "the answer" is.
 */
export function findAnswer(
  participants: Participant[],
  search: EventSettings,
  step: Pick<Step, "from" | "day">,
): MultiDayResult {
  const { from, day: pickedDay } = step;
  // A picked day is searched on its own first. Searching on from it would
  // pass over a day that needs someone to skip something whenever a clean
  // date follows within a week (findMeetingSlot), so the click would land
  // on that later date instead.
  if (pickedDay && from && search.kind === "single") {
    const dayEnd = new Date(addDays(Date.parse(from), 1, TZ)).toISOString();
    const onDay = findEventSlot(participants, search, searchStart(search, from), dayEnd, TZ);
    if (onDay.slot) return onDay;
  }
  return findEventSlot(participants, search, searchStart(search, from), SEARCH_WINDOW.end, TZ);
}

/**
 * Where a search begins: the day asked for, but for a meeting never a moment
 * already gone, so at 20:00 today's 18:00 isn't offered. (The engine trims a
 * day's window to the search start, and a window cut short no longer fits
 * the meeting.) Trips and holidays are whole days and keep today.
 */
function searchStart(search: EventSettings, from: string | null): string {
  const base = from ?? TODAY;
  if (search.kind !== "single") return base;
  return new Date(Math.max(Date.parse(base), Date.now())).toISOString();
}
