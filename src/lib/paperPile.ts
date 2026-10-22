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
 * The month in the period with the most days free for everyone: the one the
 * pile shows (#126). The earliest wins a tie; with none free anywhere, the
 * period's first month.
 */
export function busiestMonth(
  participants: Participant[],
  search: EventSettings,
  opts: PileOptions,
): { year: number; month: number } {
  const { timeZone, window } = opts;
  const end = Date.parse(window.end);
  let best = { ...localDate(Date.parse(window.start), timeZone), count: -1 };
  for (
    let month = startOfMonth(Date.parse(window.start), timeZone);
    month < end;
    month = startOfMonth(month, timeZone, 1)
  ) {
    const { year, month: m } = localDate(month, timeZone);
    const count = throughDays(
      monthAvailability(participants, search, year, m, opts),
      window,
    ).filter(Boolean).length;
    if (count > best.count) best = { ...localDate(month, timeZone), count };
  }
  return { year: best.year, month: best.month };
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
 * milliseconds, but watching every calendar land is what makes the answer
 * believable. The sheets land faster and faster, so a big group still fits.
 */
export const PILE_TIMING = {
  /** Your own sheet settling first. */
  yours: 0.6,
  /** The first member's sheet. */
  firstLand: 0.9,
  /** Each sheet after takes this share of the one before... */
  speedUp: 0.75,
  /** ...but never less than this. */
  fastestLand: 0.14,
  /** The pile lying still before the press. */
  settle: 0.5,
  press: 1.1,
  /** The days free for everyone shining through. */
  reveal: 0.9,
  /** Those days lifting out into a grid. */
  lift: 0.8,
  /** The ranking pass over the grid. */
  rank: 1.8,
} as const;

export interface PileTimeline {
  /** When each member's sheet starts to land, and how long it takes. */
  lands: { at: number; duration: number }[];
  pressAt: number;
  revealAt: number;
  liftAt: number;
  rankAt: number;
  doneAt: number;
}

/** When everything happens, for a pile of `others` sheets on top of yours. */
export function pileTimeline(others: number): PileTimeline {
  const T = PILE_TIMING;
  const lands: PileTimeline["lands"] = [];
  let at = T.yours;
  for (let i = 0; i < others; i++) {
    const duration = Math.max(T.fastestLand, T.firstLand * T.speedUp ** i);
    lands.push({ at, duration });
    at += duration;
  }
  const pressAt = at + T.settle;
  const revealAt = pressAt + T.press;
  const liftAt = revealAt + T.reveal;
  const rankAt = liftAt + T.lift;
  return { lands, pressAt, revealAt, liftAt, rankAt, doneAt: rankAt + T.rank };
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
    x: round((spread(0.414214) * 2 - 1) * 14),
    y: round((spread(0.732051) * 2 - 1) * 10),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;
