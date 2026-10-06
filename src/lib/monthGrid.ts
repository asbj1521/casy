/**
 * One week of the month view on the swipe screen's calendar (#74), laid out
 * as Apple Calendar's month view does it: everything on a day as a chip
 * under its number, something lasting several days as one bar across them,
 * each in a row ("lane") of its own the whole way, and what doesn't fit
 * counted per day ("+2"). Pure, so the layout is tested rather than eyeballed.
 */

/** Something to show in the month: a busy block, a holiday, or the suggested date. */
export interface GridItem {
  calendarId: string;
  start: number;
  end: number;
  label: string;
  /** The suggested date, pencilled in: always placed first, so it always shows. */
  pencil?: boolean;
}

export interface PlacedItem {
  item: GridItem;
  lane: number;
  /** The first and last day (0 = Monday) it covers this week. */
  from: number;
  to: number;
  /** It runs on from last week, or into next: drawn without that end rounded. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * `days` are the week's seven local midnights, Monday first; `weekEnd` the
 * midnight after the last. `lanes` is how many rows fit under a number.
 */
export function layoutWeek(
  items: GridItem[],
  days: number[],
  weekEnd: number,
  lanes: number,
): { placed: PlacedItem[]; hidden: number[] } {
  const column = (t: number) => {
    let c = 0;
    while (c < 6 && days[c + 1] <= t) c++;
    return c;
  };
  const inWeek = items
    .filter((i) => i.end > days[0] && i.start < weekEnd)
    .map((item) => ({
      item,
      from: item.start <= days[0] ? 0 : column(item.start),
      to: item.end >= weekEnd ? 6 : column(item.end - 1),
      continuesBefore: item.start < days[0],
      continuesAfter: item.end > weekEnd,
    }))
    // The suggested date first, then the longest, then the earliest.
    .sort(
      (a, b) =>
        Number(!!b.item.pencil) - Number(!!a.item.pencil) ||
        b.to - b.from - (a.to - a.from) ||
        a.item.start - b.item.start,
    );

  const taken = Array.from({ length: lanes }, () => Array<boolean>(7).fill(false));
  const hidden = Array<number>(7).fill(0);
  const placed: PlacedItem[] = [];
  for (const p of inWeek) {
    const span = Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i);
    const lane = taken.findIndex((row) => span.every((c) => !row[c]));
    if (lane === -1) {
      for (const c of span) hidden[c]++;
      continue;
    }
    for (const c of span) taken[lane][c] = true;
    placed.push({ ...p, lane });
  }
  return { placed, hidden };
}
