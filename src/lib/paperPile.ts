/**
 * The paper pile (#126): how Casy shows what finding a date takes. Every
 * member's month is a paper sheet, their free days green and their busy days
 * red; the sheets land on yours in a crooked pile, faster each time, are
 * pressed flat, and the days free on every sheet shine through. Those lift
 * out as the dates to choose among.
 *
 * Only what members already see of each other: whether a day is free for
 * this event, never what is on it. Each sheet is the day chart's own count
 * (monthAvailability) for one person, and what shines through is the chart's
 * count for the whole group, so the pile always tells the answer's story.
 * Pure: the drawing is PaperPile.tsx.
 */
import { peopleForSearch, type EventSettings } from "@/lib/eventSearch";
import {
  monthAvailability,
  type DayCell,
  type MonthAvailabilityOptions,
} from "@/lib/monthAvailability";
import { localDate, startOfMonth, wallTime } from "@/lib/zone";
import type { Participant } from "@/types";

/**
 * A day on one sheet: free, free only by skipping something or taking time
 * off ("soft"), busy, or not searched at all (past, outside the period, a
 * weekday not picked).
 */
export type SheetDay = "free" | "soft" | "busy" | "off";

export interface PileSheet {
  profileId: string;
  name: string;
  isYou: boolean;
  /** Every day of the month, the 1st first. */
  days: SheetDay[];
}

export interface Pile {
  year: number;
  /** 0-based, as everywhere in zone.ts. */
  month: number;
  /** "Juni 2026". */
  label: string;
  /** Empty cells before the 1st, the week starting on Monday. */
  lead: number;
  /** Yours first, then the others in the group's order. */
  sheets: PileSheet[];
  /** Per day: free for enough of the people searched, the days that shine through. */
  through: boolean[];
}

export interface PileOptions extends MonthAvailabilityOptions {
  /** The period searched: days outside it are off on every sheet. */
  window: { start: string; end: string };
}

/**
 * The month `year`/`month` as a pile: a sheet for everyone the search looks
 * at (required members with a calendar; optional ones never block, so a
 * sheet of theirs would knock out days that are really free), yours first.
 */
export function buildPile(
  participants: Participant[],
  search: EventSettings,
  youProfileId: string | null,
  year: number,
  month: number,
  opts: PileOptions,
): Pile {
  const { searched } = peopleForSearch(participants, search.people);
  const ordered = [
    ...searched.filter((p) => p.profileId === youProfileId),
    ...searched.filter((p) => p.profileId !== youProfileId),
  ];
  // One person at a time, as everyone: their sheet asks only whether they can.
  const alone: EventSettings = { ...search, people: undefined };
  const sheets = ordered.map((p) => ({
    profileId: p.profileId,
    name: p.name,
    isYou: p.profileId === youProfileId,
    days: monthAvailability([p], alone, year, month, opts).days.map((d) =>
      sheetDay(d, inWindow(d, opts.window)),
    ),
  }));
  const group = monthAvailability(participants, search, year, month, opts);
  const first = localDate(wallTime(year, month, 1, 0, opts.timeZone), opts.timeZone);
  return {
    year,
    month,
    label: group.label,
    lead: (first.dow + 6) % 7,
    sheets,
    through: throughDays(group, opts.window),
  };
}

/**
 * The month the pile shows (#126): the one holding most of the dates about
 * to be offered, so they lift out of the month just watched. Not the month
 * with the most free days: that is a far one nobody has planned yet, all
 * green on every sheet, where the pile would knock nothing out. The earliest
 * wins a tie; with no dates, the month `fallback` (the period's start) is in.
 */
export function candidateMonth(
  starts: string[],
  fallback: string,
  timeZone: string,
): { year: number; month: number } {
  const counts = new Map<number, number>();
  for (const start of starts) {
    const month = startOfMonth(Date.parse(start), timeZone);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  let best = startOfMonth(Date.parse(fallback), timeZone);
  let most = 0;
  for (const [month, count] of counts) {
    if (count > most || (count === most && month < best)) [best, most] = [month, count];
  }
  const { year, month } = localDate(best, timeZone);
  return { year, month };
}

function sheetDay(day: DayCell, searched: boolean): SheetDay {
  if (!searched || day.excluded || day.isPast) return "off";
  if (day.freeCount > 0) return "free";
  return day.conditionalCount > 0 ? "soft" : "busy";
}

function inWindow(day: DayCell, window: { start: string; end: string }): boolean {
  const ms = Date.parse(day.date);
  return ms >= Date.parse(window.start) && ms < Date.parse(window.end);
}

function throughDays(
  month: ReturnType<typeof monthAvailability>,
  window: { start: string; end: string },
): boolean[] {
  return month.days.map(
    (d) =>
      month.enough > 0 &&
      d.freeCount >= month.enough &&
      !d.excluded &&
      !d.isPast &&
      inWindow(d, window),
  );
}

/**
 * The pile's timing, in seconds. Deliberately slow (#126): the search takes
 * milliseconds, but watching every calendar land and every date checked is
 * what makes the answer believable. The calendars are thrown faster and
 * faster, so a big group still fits.
 */
export const PILE_TIMING = {
  /** My calendar scrolling to the month. */
  yours: 0.6,
  /** The first friend's calendar in the air. */
  firstLand: 0.9,
  /** Each throw after takes this share of the one before... */
  speedUp: 0.75,
  /** ...but never less than this. */
  fastestLand: 0.14,
  /** The hit after a throw: skid, a hop, settling. Overlaps the next throw. */
  impact: 0.45,
  /** The pile lying still before the press. */
  settle: 0.4,
  /** The press, from the middle out, the layers settling into line. */
  press: 1.0,
  /** The days free for everyone lighting up. */
  reveal: 1.0,
  /** Those days flying up into the list. */
  fly: 0.9,
  /** Each date in the list being checked, one after another. */
  checkEach: 0.6,
} as const;

export interface PileTimeline {
  /** When each friend's calendar is thrown, and how long it is in the air. */
  lands: { at: number; duration: number }[];
  pressAt: number;
  revealAt: number;
  /** The dates fly up into the list. */
  liftAt: number;
  /** The list's dates start being checked. */
  rankAt: number;
  doneAt: number;
}

/**
 * When everything happens, for `others` calendars thrown onto yours and
 * `dates` dates checked in the list.
 */
export function pileTimeline(others: number, dates = 0): PileTimeline {
  const T = PILE_TIMING;
  const lands: PileTimeline["lands"] = [];
  let at = T.yours;
  for (let i = 0; i < others; i++) {
    const duration = Math.max(T.fastestLand, T.firstLand * T.speedUp ** i);
    lands.push({ at, duration });
    at += duration;
  }
  const lastHit = others > 0 ? at + T.impact : at;
  const pressAt = lastHit + T.settle;
  const revealAt = pressAt + T.press;
  const liftAt = revealAt + T.reveal;
  const rankAt = liftAt + T.fly;
  return { lands, pressAt, revealAt, liftAt, rankAt, doneAt: rankAt + dates * T.checkEach };
}

/** Which side calendar `k` (0 the first friend's) is thrown from: left, then right, and so on. */
export const throwSide = (k: number): -1 | 1 => (k % 2 === 0 ? -1 : 1);

/**
 * How far the calendars already on the pile have been knocked once `landed`
 * calendars have landed: each one that lands after calendar `k` shoves it a
 * little away from the side it came from, less for each one further up.
 * Pixels and degrees; nothing for a calendar not yet down.
 */
export function jostle(k: number, landed: number): { x: number; rotate: number } {
  let x = 0;
  let rotate = 0;
  for (let j = k + 1; j < landed; j++) {
    const push = -throwSide(j) * 0.7 ** (j - k - 1);
    x += push * 3;
    rotate += push * 0.6;
  }
  return { x: round(x), rotate: round(rotate) };
}

/** How opaque the whole pile gets: by the last layer you can't see through it. */
export const PILE_OPACITY = 0.92;

/**
 * How opaque each of `layers` glass layers is, so that together they reach
 * PILE_OPACITY: each layer lets through (1 - a) of what is under it, so n of
 * them let through (1 - a)^n. A group of two builds up to the same murk as a
 * group of twenty, each layer adding less the more there are.
 */
export function layerAlpha(layers: number): number {
  if (layers <= 0) return 0;
  return 1 - (1 - PILE_OPACITY) ** (1 / layers);
}

/**
 * How crooked sheet `index` lies in the pile: degrees and pixels. Yours (0)
 * lies straight; the others alternate sides and never lie straight, spread
 * by the golden ratio so neighbours differ. Fixed per index, so the pile
 * looks the same every time (and in screenshots).
 */
export function sheetTilt(index: number): { rotate: number; x: number; y: number } {
  if (index === 0) return { rotate: 0, x: 0, y: 0 };
  const spread = (k: number) => (index * k) % 1;
  const side = index % 2 === 0 ? 1 : -1;
  return {
    rotate: round(side * (2 + 5 * spread(0.618034))),
    x: round((spread(0.414214) * 2 - 1) * 8),
    y: round((spread(0.732051) * 2 - 1) * 10),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
