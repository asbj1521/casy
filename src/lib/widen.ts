/**
 * Ways to widen a search that found no date (#135): another time of day, more
 * weekdays, a shorter event, more months, or fewer people needed. Each is
 * tried with the same search the page runs, and only the ones that find a
 * date are offered, each with the first date it finds, so a tap never leads
 * to "still nothing". Plain code over calendars already loaded: no AI call.
 *
 * A deadline the AI set as exact days (#134, "before 5 November") is firm:
 * the period is never widened past it. Months picked by hand may grow.
 */
import { findEventSlot, START_STEP_MINUTES, type StartWindow } from "@/lib/eventSearch";
import {
  ALL_DOWS,
  MAX_TRIP_DAYS,
  peopleFromChoice,
  periodWindow,
  settingsToSearch,
  type FoundDate,
  type PeopleChoice,
  type Period,
  type SchedulerSettings,
} from "@/lib/scheduler";
import { startOfDay, startOfMonth } from "@/lib/zone";
import type { Participant } from "@/types";

/** The parts of the day a meeting may move to, as start windows, earliest first. */
const DAY_PARTS = {
  morning: { from: 9 * 60, to: 11 * 60 },
  lunch: { from: 11 * 60 + 30, to: 13 * 60 },
  afternoon: { from: 13 * 60, to: 16 * 60 },
  evening: { from: 18 * 60, to: 21 * 60 },
} as const satisfies Record<string, StartWindow>;
type DayPart = keyof typeof DAY_PARTS;

/** What a way of widening changes, said the way the box names it. */
type Widening =
  | { kind: "time"; part: DayPart | "any" }
  | { kind: "days" }
  | { kind: "startDay" }
  | { kind: "shorter"; minutes: number }
  | { kind: "fewerDays"; days: number }
  | { kind: "months"; period: Period }
  | { kind: "people"; atLeast: number; of: number };

export interface WidenOption {
  widening: Widening;
  /** The settings it searches with: the page's, with this one change. */
  settings: SchedulerSettings;
  /** Who it is for, when that is what changes. */
  people: PeopleChoice | null;
  /** The first date it finds. */
  first: FoundDate;
}

/** The most options the box shows: the ones finding the earliest dates. */
const MAX_OPTIONS = 4;

export interface WidenInput {
  participants: Participant[];
  settings: SchedulerSettings;
  /** The group's members by profile id, and who of them the event is for. */
  members: string[];
  choice: PeopleChoice;
  /** Today's local midnight, and the year every search covers (SEARCH_WINDOW). */
  today: string;
  limit: { start: string; end: string };
  timeZone: string;
  /** For a meeting, never a start already gone (as the page's own search). */
  now?: number;
}

/**
 * The first date `settings` and `choice` find, by the page's own rules
 * (findAnswer: the period's window, a meeting never in the past); null for none.
 */
function firstDate(
  input: WidenInput,
  settings: SchedulerSettings,
  choice: PeopleChoice,
): FoundDate | null {
  const search = settingsToSearch(
    settings,
    peopleFromChoice(input.members, choice, !settings.multiDay),
  );
  const window = periodWindow(settings.period, input.today, input.limit, input.timeZone);
  const start =
    search.kind === "single"
      ? new Date(Math.max(Date.parse(window.start), input.now ?? Date.now())).toISOString()
      : window.start;
  const found = findEventSlot(input.participants, search, start, window.end, input.timeZone);
  return found.slot ? { ...found, slot: found.slot } : null;
}

/** Every way to widen `input.settings` that finds a date, earliest date first. */
export function widenOptions(input: WidenInput): WidenOption[] {
  const { settings: s, choice } = input;
  const options: WidenOption[] = [];
  const offer = (widening: Widening, settings: SchedulerSettings, people: PeopleChoice | null) => {
    const first = firstDate(input, settings, people ?? choice);
    if (first) options.push({ widening, settings, people, first });
    return !!first;
  };
  /** The first of `tries` that finds a date, offered; the rest aren't tried. */
  const firstThatWorks = (tries: [Widening, SchedulerSettings][]) => {
    for (const [widening, settings] of tries) if (offer(widening, settings, null)) return;
  };

  if (!s.multiDay) {
    // Another part of the day: of those that find a date, the earliest date.
    const times: [Widening, SchedulerSettings][] = (
      Object.entries(DAY_PARTS) as [DayPart, StartWindow][]
    )
      .filter(([, w]) => s.startWindow?.from !== w.from || s.startWindow?.to !== w.to)
      .map(([part, w]) => [
        { kind: "time", part },
        { ...s, anyTime: false, startWindow: w, startHour: Math.floor(w.from / 60) },
      ]);
    if (!s.anyTime)
      times.push([
        { kind: "time", part: "any" },
        { ...s, anyTime: true, startWindow: null },
      ]);
    const found = times
      .map(([widening, settings]): WidenOption | null => {
        const first = firstDate(input, settings, choice);
        return first ? { widening, settings, people: null, first } : null;
      })
      .filter((o): o is WidenOption => o !== null);
    const earliest = found.sort(byDate)[0];
    if (earliest) options.push(earliest);

    if (s.dows.length < 7) offer({ kind: "days" }, { ...s, dows: [...ALL_DOWS] }, null);

    // The longest shorter meeting that fits, down to half its length.
    const shorter: [Widening, SchedulerSettings][] = [];
    const floor = Math.max(START_STEP_MINUTES, Math.ceil(s.durationMinutes / 2 / 30) * 30);
    for (let m = s.durationMinutes - 30; m >= floor; m -= 30) {
      shorter.push([
        { kind: "shorter", minutes: m },
        { ...s, durationMinutes: m },
      ]);
    }
    firstThatWorks(shorter);

    // Fewer people: one less needed than now, while at least two still meet.
    const required = requiredCount(input.members, choice);
    const atLeast = (choice.atLeast ?? required) - 1;
    if (atLeast >= MIN_COUNT && input.participants.length >= 3) {
      offer({ kind: "people", atLeast, of: required }, s, { ...choice, atLeast });
    }
  } else {
    // A trip may start on another day: any day makes it a holiday.
    if (s.startDow !== null) offer({ kind: "startDay" }, { ...s, startDow: null }, null);
    // A shorter trip (a holiday has its own shorter stays, VacationSuggestion).
    if (s.startDow !== null) {
      const fewer: [Widening, SchedulerSettings][] = [];
      for (
        let d = Math.min(s.days, MAX_TRIP_DAYS) - 1;
        d >= Math.max(1, Math.ceil(s.days / 2));
        d--
      ) {
        fewer.push([
          { kind: "fewerDays", days: d },
          { ...s, days: d },
        ]);
      }
      firstThatWorks(fewer);
    }
  }

  // More months, the fewest that find a date; never past exact days (#134).
  if (s.period && !s.period.days) {
    const last = startOfMonth(Date.parse(input.limit.end) - 1, input.timeZone);
    const more: [Widening, SchedulerSettings][] = [];
    for (let n = 1; ; n++) {
      const to = startOfMonth(Date.parse(s.period.to), input.timeZone, n);
      if (to > last) break;
      const period = { from: s.period.from, to: new Date(to).toISOString() };
      more.push([
        { kind: "months", period },
        { ...s, period },
      ]);
    }
    firstThatWorks(more);
  }

  return options.sort(byDate).slice(0, MAX_OPTIONS);
}

/** The members a choice needs (Med), by the same default as peopleFromChoice. */
export function requiredCount(members: string[], choice: PeopleChoice): number {
  return members.filter((id) => (choice.states[id] ?? "required") === "required").length;
}

/** The fewest a "how many need to come" may ask for: below two, nobody meets. */
export const MIN_COUNT = 2;

/**
 * The share of those Med the how-many slider goes down to (#263): below it,
 * it is a few friends meeting, not the group with some missing.
 */
const GROUP_SHARE = 0.65;

/**
 * The slider's lowest step for `of` Med (#263): GROUP_SHARE of them,
 * rounded, never below MIN_COUNT (8 to 5, 10 to 7, 15 to 10). A lower
 * count already chosen (Deltagere's "Mindst") stays reachable, so the
 * slider always shows what is picked.
 */
export function lowestCount(of: number, atLeast: number | null = null): number {
  const floor = Math.max(MIN_COUNT, Math.round(of * GROUP_SHARE));
  return atLeast === null ? floor : Math.max(MIN_COUNT, Math.min(floor, atLeast));
}

export interface CountOption {
  /** How many of those Med must be able to come. */
  count: number;
  /** Of how many: everyone Med. */
  of: number;
  /** The first date it finds in the months picked, or null for none there. */
  first: FoundDate | null;
}

/**
 * Planlæg's "Hvor mange skal kunne" (#259, #255): for a meeting, each count
 * from everyone Med down to lowestCount (#263), with the first date it finds, so what each
 * person fewer buys is seen before it is picked. The same search as the
 * page's own (firstDate), within the months picked, so a count with no date
 * there says the period can't hold it. Empty for a trip ("at least" is for
 * meetings only) or fewer than three Med.
 */
export function firstDateByCount(
  input: WidenInput,
  /** A genvej's other times (#175), searched beside `input.settings`: each count's earliest. */
  others: SchedulerSettings[] = [],
): CountOption[] {
  if (input.settings.multiDay) return [];
  const of = requiredCount(input.members, input.choice);
  if (of <= MIN_COUNT) return [];
  const options: CountOption[] = [];
  for (let count = of; count >= lowestCount(of, input.choice.atLeast); count--) {
    const choice = { ...input.choice, atLeast: count === of ? null : count };
    const found = [input.settings, ...others]
      .map((settings) => firstDate(input, settings, choice))
      .filter((f): f is FoundDate => f !== null);
    options.push({ count, of, first: found.sort(byStart)[0] ?? null });
  }
  return options;
}

const byStart = (a: FoundDate, b: FoundDate) => Date.parse(a.slot.start) - Date.parse(b.slot.start);

/** Whole days from `first`'s day to `than`'s, as the slider says "5 uger tidligere" (#259). */
export function daysSooner(first: string, than: string, timeZone: string): number {
  const day = (iso: string) => startOfDay(Date.parse(iso), timeZone);
  // Rounded: a day across a clock change is 23 or 25 hours.
  return Math.round((day(than) - day(first)) / 86_400_000);
}

/** Earliest first date first; the order tried breaks a tie. */
function byDate(a: WidenOption, b: WidenOption): number {
  return Date.parse(a.first.slot.start) - Date.parse(b.first.slot.start);
}
