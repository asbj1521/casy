/**
 * Warnings about a meeting's edges, for everyone still invited:
 *  - early morning: it ends at 23:00 or later, and someone has something
 *    starting at 10:00 or earlier the next morning;
 *  - back to back: someone has something ending exactly when it starts
 *    (school until 16:00, the meeting at 16:00).
 *
 * Only warnings: the date still stands. What they show (a name and a time)
 * is what group members can already see of each other's busy time. The
 * holiday blocks everyone shares (holidayBlocks.ts) never count: they are
 * nobody's own plans.
 */
import type { Lang } from "@/i18n/locale";
import { blockRange } from "@/lib/availability";
import { formatTime, nameList } from "@/lib/format";
import { addDays, atHour, startOfDay } from "@/lib/zone";
import type { Participant } from "@/types";

/** A meeting ending at this local hour or later counts as late. */
const LATE_FROM_HOUR = 23;
/** Something starting at this local hour or earlier the next morning counts as early. */
const EARLY_UNTIL_HOUR = 10;

/** At least this long from a local midnight, it's an all-day entry, not an early start. */
const ALL_DAY_MS = 23 * 60 * 60 * 1000;

export interface EarlyStart {
  profileId: string;
  name: string;
  /** When their first thing the next morning starts, ISO UTC. */
  start: string;
}

/** True if the meeting ends at LATE_FROM_HOUR or later (or past midnight). */
function isLateMeeting(slot: { start: string; end: string }, timeZone: string): boolean {
  return Date.parse(slot.end) >= atHour(Date.parse(slot.start), LATE_FROM_HOUR, timeZone);
}

function isAllDay(start: number, end: number, timeZone: string): boolean {
  return start === startOfDay(start, timeZone) && end - start >= ALL_DAY_MS;
}

/** People in a warning, you first: "You, Emilie and Tessa". */
function youFirst<T extends { profileId: string }>(people: T[], youId: string | null): T[] {
  return [...people].sort((a, b) => Number(b.profileId === youId) - Number(a.profileId === youId));
}

/**
 * Everyone with something early the morning after `slot`, soonest first, or
 * nobody when the meeting isn't late. All-day entries don't count. Calendars
 * marked skippable do: skipping says the time may be planned over, not that
 * a late night before it doesn't matter.
 */
export function earlyMorningStarts(
  participants: Participant[],
  slot: { start: string; end: string },
  timeZone: string,
): EarlyStart[] {
  if (!isLateMeeting(slot, timeZone)) return [];
  const start = Date.parse(slot.start);
  const end = Date.parse(slot.end);

  // The morning after: the next day, or the day it ends on if it runs past midnight.
  const endDay = startOfDay(end, timeZone);
  const morning = endDay === startOfDay(start, timeZone) ? addDays(start, 1, timeZone) : endDay;
  const until = atHour(morning, EARLY_UNTIL_HOUR, timeZone);

  const found: { profileId: string; name: string; first: number }[] = [];
  for (const p of participants) {
    let first = Infinity;
    for (const b of p.busy) {
      const iv = blockRange(b);
      if (!iv || b.holiday || iv.start < end || iv.start > until) continue;
      if (!isAllDay(iv.start, iv.end, timeZone)) first = Math.min(first, iv.start);
    }
    if (first < Infinity) found.push({ profileId: p.profileId, name: p.name, first });
  }
  return found
    .sort((a, b) => a.first - b.first)
    .map(({ profileId, name, first }) => ({
      profileId,
      name,
      start: new Date(first).toISOString(),
    }));
}

/** The words earlyMorningNote needs (t.earlyMorning). */
export interface EarlyMorningWords {
  you: string;
  oneYou: (time: string) => string;
  one: (who: string, time: string) => string;
  many: (list: string) => string;
}

/** The warning as one sentence, you first, or null when nobody starts early. */
export function earlyMorningNote(
  starts: EarlyStart[],
  youId: string | null,
  lang: Lang,
  words: EarlyMorningWords,
): string | null {
  if (starts.length === 0) return null;
  const ordered = youFirst(starts, youId);
  if (ordered.length === 1) {
    const [s] = ordered;
    return s.profileId === youId
      ? words.oneYou(formatTime(s.start))
      : words.one(s.name, formatTime(s.start));
  }
  return words.many(
    nameList(
      ordered.map((s) => `${s.profileId === youId ? words.you : s.name} (${formatTime(s.start)})`),
      lang,
    ),
  );
}

/** Someone whose previous thing ends exactly when the meeting starts. */
export interface BackToBack {
  profileId: string;
  name: string;
}

/**
 * Everyone with something ending exactly when `slot` starts, in list order.
 * All-day entries don't count (a day off ending at midnight is no rush);
 * skippable calendars do, as for the early morning.
 */
export function backToBackEnds(
  participants: Participant[],
  slot: { start: string; end: string },
  timeZone: string,
): BackToBack[] {
  const start = Date.parse(slot.start);
  return participants
    .filter((p) =>
      p.busy.some((b) => {
        const iv = blockRange(b);
        return !!iv && iv.end === start && !b.holiday && !isAllDay(iv.start, iv.end, timeZone);
      }),
    )
    .map((p) => ({ profileId: p.profileId, name: p.name }));
}

/** The words backToBackNote needs (t.backToBack). */
export interface BackToBackWords {
  you: string;
  oneYou: string;
  one: (who: string) => string;
  many: (list: string) => string;
}

/** The back-to-back warning as one sentence, you first, or null for nobody. */
export function backToBackNote(
  people: BackToBack[],
  youId: string | null,
  lang: Lang,
  words: BackToBackWords,
): string | null {
  if (people.length === 0) return null;
  const ordered = youFirst(people, youId);
  if (ordered.length === 1) {
    return ordered[0].profileId === youId ? words.oneYou : words.one(ordered[0].name);
  }
  return words.many(
    nameList(
      ordered.map((p) => (p.profileId === youId ? words.you : p.name)),
      lang,
    ),
  );
}

/** One of a meeting's edge warnings, as the pages show it. */
export interface EdgeWarning {
  kind: "backToBack" | "earlyMorning";
  text: string;
}

/**
 * Both warnings for a meeting on `slot`, in the order the pages show them:
 * back to back first, then the early morning after. Empty when neither applies.
 */
export function edgeWarnings(
  participants: Participant[],
  slot: { start: string; end: string },
  timeZone: string,
  youId: string | null,
  lang: Lang,
  words: { backToBack: BackToBackWords; earlyMorning: EarlyMorningWords },
): EdgeWarning[] {
  const warnings: EdgeWarning[] = [];
  const backToBack = backToBackNote(
    backToBackEnds(participants, slot, timeZone),
    youId,
    lang,
    words.backToBack,
  );
  if (backToBack) warnings.push({ kind: "backToBack", text: backToBack });
  const earlyMorning = earlyMorningNote(
    earlyMorningStarts(participants, slot, timeZone),
    youId,
    lang,
    words.earlyMorning,
  );
  if (earlyMorning) warnings.push({ kind: "earlyMorning", text: earlyMorning });
  return warnings;
}
