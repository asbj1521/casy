/** One busy block as the groups function sends it: times, and what it means for planning. */
export interface SentBlock {
  start: string;
  end: string;
  category?: string;
  priority?: string;
}

/**
 * A member's blocks with exact repeats left out (#158): the same event in two
 * of their calendars (a shared calendar and their own, say) arrives once.
 * Only exact repeats, same times and same tags: merging blocks that merely
 * overlap could turn a whole-day absence into an ordinary block, which the
 * engine treats differently. Order is kept.
 */
export function withoutRepeats(blocks: SentBlock[]): SentBlock[] {
  const seen = new Set<string>();
  return blocks.filter((b) => {
    const key = `${Date.parse(b.start)}|${Date.parse(b.end)}|${b.category ?? ""}|${b.priority ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
