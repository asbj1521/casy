import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  findVacationSuggestions,
  type MultiDayResult,
  type VacationSuggestion,
} from "@/lib/availability";
import type { EventToProfile } from "@/api/eventProfile";
import { eventProfileQuery } from "@/hooks/useEventProfile";
import type { Step } from "@/lib/answerSteps";
import { findEventSlot, SEARCH_WINDOW, type EventSettings } from "@/lib/eventSearch";
import { bigOnNewYearsDay, onNewYearsDay } from "@/lib/newYear";
import { laterSlots, type FoundDate } from "@/lib/scheduler";
import { addDays, APP_TIME_ZONE, dayOf } from "@/lib/zone";
import type { Participant } from "@/types";

const TZ = APP_TIME_ZONE;

/** Today as a local-midnight ISO, from when the page was loaded. Never searched before. */
export const TODAY = dayOf(new Date().toISOString(), TZ);

/** How many later dates the "Også muligt" row offers. */
const LATER_COUNT = 3;

/** Where a search may look: from `start` (on or after today) to `end`, exclusive. */
interface SearchWindow {
  start: string;
  end: string;
}

/** The event's profile (#113) as asked for: whose, and about what. */
interface ProfileKey {
  userId: string;
  input: EventToProfile;
}

/** No profile to read: a key nothing is ever stored under. */
const NO_PROFILE = { userId: "", input: {} as EventToProfile };

/** Every search's window unless a period narrows it: today through the year searched. */
const WHOLE_YEAR: SearchWindow = { start: TODAY, end: SEARCH_WINDOW.end };

interface DateSearch {
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
 * where "everyone" would otherwise be free today. Every date lies within
 * `window`: the period picked on the page (#74), or the whole year.
 *
 * A big plan on 1 January (#166) is stepped past, and left out of the later
 * dates, as the event's profile says (`profile`, null for none). The profile
 * is read from the cache only while the answer or a later date is on that
 * day: anywhere else its arrival would redraw the page for nothing, and a
 * redraw recentres the scheduler's wheels mid-turn (useEventProfile).
 */
export function useDateSearch(
  participants: Participant[] | null,
  search: EventSettings,
  step: Step,
  window: SearchWindow,
  profile: ProfileKey | null = null,
): DateSearch {
  const { from, day: pickedDay } = step;

  const plain = useMemo(
    () =>
      participants ? findAnswer(participants, search, { from, day: pickedDay }, window) : null,
    [participants, search, from, pickedDay, window],
  );
  const plainLater = useMemo(() => {
    if (!participants || !plain?.slot) return [];
    return laterSlots(participants, search, plain.slot.start, LATER_COUNT, window.end, TZ);
  }, [participants, search, plain, window]);

  const nearNewYear = [plain?.slot, ...plainLater.map((d) => d.slot)].some(
    (s) => !!s && onNewYearsDay(s.start, TZ),
  );
  const key = nearNewYear && profile ? profile : NO_PROFILE;
  const { data: impact } = useQuery({
    ...eventProfileQuery(key.userId, key.input),
    // Only read from the cache, which the page fills while the event is set up.
    enabled: false,
  });
  const isBig = useMemo(
    () => (slot: { start: string; end: string }) =>
      bigOnNewYearsDay(nearNewYear ? impact : null, slot, search, TZ),
    [nearNewYear, impact, search],
  );
  const stepped = !!plain?.slot && isBig(plain.slot);
  const found = useMemo(
    () =>
      participants && stepped
        ? findAnswer(participants, search, { from, day: pickedDay }, window, isBig)
        : plain,
    [participants, stepped, search, from, pickedDay, window, isBig, plain],
  );

  // "6 days works for everyone if you leave after work Friday" and the like.
  const suggestions = useMemo(() => {
    if (search.kind !== "vacation" || !participants || !found) return [];
    if (found.slot && found.conflicts.length === 0) return [];
    return findVacationSuggestions(
      participants,
      search.days,
      startWithin(from, window),
      window.end,
      TZ,
    );
  }, [participants, search, found, from, window]);

  const slot = found?.slot ?? null;
  const later = useMemo(() => {
    if (!participants || !slot || suggestions.length > 0) return [];
    const after =
      found === plain
        ? plainLater
        : laterSlots(participants, search, slot.start, LATER_COUNT, window.end, TZ);
    return after.filter((d) => !isBig(d.slot));
  }, [participants, search, slot, suggestions, window, found, plain, plainLater, isBig]);

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
 * the page can never disagree about what "the answer" is. A date `isBig`
 * calls a big plan on 1 January (#166) is stepped past, unless it is the
 * day picked.
 */
export function findAnswer(
  participants: Participant[],
  search: EventSettings,
  step: Pick<Step, "from" | "day">,
  window: SearchWindow = WHOLE_YEAR,
  isBig: (slot: { start: string; end: string }) => boolean = () => false,
): MultiDayResult {
  const { day: pickedDay } = step;
  const from = startWithin(step.from, window);
  // A picked day is searched on its own first. Searching on from it would
  // pass over a day that needs someone to skip something whenever a clean
  // date follows within a week (findMeetingSlot), so the click would land
  // on that later date instead.
  if (pickedDay && step.from && search.kind === "single") {
    const dayEnd = new Date(addDays(Date.parse(from), 1, TZ)).toISOString();
    const onDay = findEventSlot(participants, search, searchStart(search, from), dayEnd, TZ);
    if (onDay.slot) return onDay;
  }
  let found = findEventSlot(participants, search, searchStart(search, from), window.end, TZ);
  // At most one 1 January lies in a search's year, so once past it is enough.
  if (found.slot && isBig(found.slot)) {
    const next = new Date(addDays(Date.parse(dayOf(found.slot.start, TZ)), 1, TZ)).toISOString();
    found = findEventSlot(participants, search, searchStart(search, next), window.end, TZ);
  }
  return found;
}

/** Where a step's search begins: the day stepped to, but never before the window. */
function startWithin(from: string | null, window: SearchWindow): string {
  return from && Date.parse(from) > Date.parse(window.start) ? from : window.start;
}

/**
 * Where a search begins: the day asked for, but for a meeting never a moment
 * already gone, so at 20:00 today's 18:00 isn't offered. (The engine trims a
 * day's window to the search start, and a window cut short no longer fits
 * the meeting.) Trips and holidays are whole days and keep today.
 */
function searchStart(search: EventSettings, base: string): string {
  if (search.kind !== "single") return base;
  return new Date(Math.max(Date.parse(base), Date.now())).toISOString();
}
