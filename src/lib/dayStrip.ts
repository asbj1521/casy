/**
 * The little day columns under a swipe card (#74): your own calendar on the
 * day before, the day of and the day after a suggested date, drawn as
 * blocks on a time axis. Pure, so where a block lands is tested rather than
 * eyeballed.
 *
 * Positions are fractions of the column's height, measured on the wall
 * clock (atHour), so a block at 18:00 sits at 18:00 on the two days a year
 * that are 23 or 25 hours long too.
 */
import type { DaySegment } from "@/lib/calendarOverview";
import { atHour } from "@/lib/zone";

/** Where the axis starts unless something earlier is on it, and where it ends. */
export const STRIP_FIRST_HOUR = 7;
export const STRIP_LAST_HOUR = 24;

/** A timed block placed on its day's column. */
export interface PlacedBlock {
  segment: DaySegment;
  /** Distance from the top, 0 to 1. */
  top: number;
  /** Height, 0 to 1. */
  height: number;
  /** Which of `lanes` side-by-side lanes it sits in, for blocks that overlap. */
  lane: number;
  lanes: number;
}

/**
 * The hour the axis starts for these days: STRIP_FIRST_HOUR, or earlier if
 * any timed block (or the suggested date itself, `alsoShow`) starts before
 * it, so an early shift is never cut off. Always a whole hour.
 */
export function firstHour(
  days: { midnight: number; segments: DaySegment[] }[],
  alsoShow: { start: number; midnight: number } | null,
  timeZone: string,
): number {
  let hour = STRIP_FIRST_HOUR;
  const pushBack = (midnight: number, start: number) => {
    while (hour > 0 && atHour(midnight, hour, timeZone) > start) hour--;
  };
  for (const { midnight, segments } of days) {
    for (const s of segments) if (!s.allDay) pushBack(midnight, s.start.getTime());
  }
  if (alsoShow) pushBack(alsoShow.midnight, alsoShow.start);
  return hour;
}

/** Where [start, end) falls on the column of the day starting at `midnight`, clipped to it. */
export function placeSpan(
  start: number,
  end: number,
  midnight: number,
  fromHour: number,
  timeZone: string,
): { top: number; height: number } {
  const top = atHour(midnight, fromHour, timeZone);
  const bottom = atHour(midnight, STRIP_LAST_HOUR, timeZone);
  const span = bottom - top;
  const a = Math.min(Math.max(start, top), bottom);
  const b = Math.min(Math.max(end, top), bottom);
  return { top: (a - top) / span, height: (b - a) / span };
}

/**
 * A day's timed blocks placed on its column. Blocks that overlap share the
 * width in lanes, so none hides another.
 */
export function placeBlocks(
  segments: DaySegment[],
  midnight: number,
  fromHour: number,
  timeZone: string,
): PlacedBlock[] {
  const timed = segments
    .filter((s) => !s.allDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = [];
  const placed = timed.map((segment) => {
    const start = segment.start.getTime();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = segment.end.getTime();
    return {
      segment,
      lane,
      ...placeSpan(start, segment.end.getTime(), midnight, fromHour, timeZone),
    };
  });
  return placed
    .filter((p) => p.height > 0)
    .map((p) => ({ ...p, lanes: Math.max(1, laneEnds.length) }));
}
