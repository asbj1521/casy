/**
 * The day columns of your calendar on the swipe screen (#74), drawn like
 * Apple Calendar's day view: the whole day from 00:00 to 24:00 at a fixed
 * height per hour, scrolled to the suggested time. Pure, so where a block
 * lands is tested rather than eyeballed.
 *
 * Positions are fractions of the day from its local midnight to the next
 * (atHour), so the two days a year that are 23 or 25 hours long still fill
 * their column; a block on them lands within a few pixels of its hour line.
 */
import type { DaySegment } from "@/lib/calendarOverview";
import { atHour } from "@/lib/zone";

/** A timed block placed on its day's column. */
export interface PlacedBlock {
  segment: DaySegment;
  /** Distance from midnight, 0 to 1 of the day. */
  top: number;
  /** Length, 0 to 1 of the day, never less than the `minHeight` asked for. */
  height: number;
  /** Where it starts across the column, and how much of it it takes, 0 to 1. */
  left: number;
  width: number;
}

/** How far a block starting during another is moved in, as Apple Calendar does. */
const INDENT = 0.3;

/** Where [start, end) falls on the day starting at `midnight`, as fractions of it, clipped to it. */
export function placeSpan(
  start: number,
  end: number,
  midnight: number,
  timeZone: string,
): { top: number; height: number } {
  const top = atHour(midnight, 0, timeZone);
  const bottom = atHour(midnight, 24, timeZone);
  const span = bottom - top;
  const a = Math.min(Math.max(start, top), bottom);
  const b = Math.min(Math.max(end, top), bottom);
  return { top: (a - top) / span, height: (b - a) / span };
}

/**
 * A day's timed blocks placed on its column, overlapping ones the way Apple
 * Calendar draws them: a block starting at about the same time as the one
 * under it (within `together`, a fraction of the day) shares its width side
 * by side; one starting later is indented over it, so the earlier block's
 * name stays readable. Later blocks are drawn on top. `minHeight` is the
 * least a block is drawn as, so even a short one has room for its name.
 */
export function placeBlocks(
  segments: DaySegment[],
  midnight: number,
  timeZone: string,
  minHeight = 0,
  together = minHeight,
): PlacedBlock[] {
  const timed = segments
    .filter((s) => !s.allDay)
    .map((segment) => ({
      segment,
      ...placeSpan(segment.start.getTime(), segment.end.getTime(), midnight, timeZone),
    }))
    .filter((p) => p.height > 0)
    .map((p) => ({ ...p, height: Math.min(Math.max(p.height, minHeight), 1 - p.top) }))
    // Earliest first; of two starting together, the longer underneath.
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const placed: PlacedBlock[] = [];
  for (const block of timed) {
    // The block drawn last that it lands on, if any.
    const under = placed.filter((p) => p.top + p.height > block.top).at(-1);
    if (!under) {
      placed.push({ ...block, left: 0, width: 1 });
    } else if (block.top - under.top < together) {
      under.width /= 2;
      placed.push({ ...block, left: under.left + under.width, width: under.width });
    } else {
      const left = under.left + under.width * INDENT;
      placed.push({ ...block, left, width: under.left + under.width - left });
    }
  }
  return placed;
}
