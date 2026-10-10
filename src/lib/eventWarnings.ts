/**
 * Common-sense warnings (#114): a date for a planned event set against the
 * important events in your own calendar, by plain rules over what the AI
 * already said about each (the labels on your events, #112, and the planned
 * event's profile, #113, through impactOn). No AI call here: the same
 * answer every time, instantly, for every date of a vote.
 *
 * The rules, for each of your events that matters (high or critical):
 *  - the night before: the planned event causes something it can't stand
 *    the day before (alcohol, a late night...), and ends within 36 hours
 *    before it starts;
 *  - preparing: it needs days to prepare, and the planned event falls on
 *    one of them. The day right before a critical event should be free:
 *    anything but something small (light, two hours at most) is flagged;
 *    further out only something big (tiring, drinking, late, half a day);
 *  - recovering: the planned event needs a day to recover from, and the
 *    event falls on it.
 * One warning per event of yours, the strongest; critical ones first.
 *
 * Your events with their titles are this phone's (the labels live on the
 * phone), so the warnings appear in the app only, and never leave it.
 */
import type { EventLabel } from "@/api/eventLabels";
import type { DateImpact } from "@/lib/eventImpact";
import { labelKey, type LabelBook } from "@/lib/eventLabels";
import type { Effect } from "@/lib/eventVocabulary";
import { busySpan } from "@/lib/phoneBusy";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";
import { startOfDay } from "@/lib/zone";

const HOUR_MS = 3_600_000;
/** How close before one of your events counts as its night before. */
export const NIGHT_BEFORE_MS = 36 * HOUR_MS;
/**
 * A night out ending before this hour belongs to the evening it began: a
 * julefrokost until 02:00 is the evening before the exam, not "the same day".
 */
export const NIGHT_ENDS_HOUR = 6;
/** At most this long, and light, is small enough for the day before a critical event. */
export const SMALL_MS = 2 * HOUR_MS;
/** From this long, an event without a profile counts as big. */
export const BIG_MS = 4 * HOUR_MS;

/** One of your own events, with what the AI made of it. */
export interface LabelledEvent {
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  label: EventLabel;
}

/**
 * This phone's events that have a label, timed as they count (busySpan):
 * cancelled, declined and free ones left out. Soonest first.
 */
export function labelledEvents(events: PhoneEventWithDetails[], book: LabelBook): LabelledEvent[] {
  const mine: LabelledEvent[] = [];
  for (const e of events) {
    const title = e.title?.trim();
    const span = busySpan(e);
    if (!title || !span) continue;
    const label = book[labelKey(e.calendarId, title)];
    if (label) mine.push({ title, start: span.start, end: span.end, allDay: e.allDay, label });
  }
  return mine.sort((a, b) => a.start - b.start);
}

export type ClashKind = "nightBefore" | "prepDayBefore" | "prep" | "recovery";

export interface ImportantClash {
  kind: ClashKind;
  /** Critical: worth asking before a yes. A warning: said, not asked. */
  severity: "critical" | "warning";
  event: LabelledEvent;
  /**
   * Calendar days from the planned event's last day to your event's day; a
   * night ending before NIGHT_ENDS_HOUR counts as the day it began.
   */
  daysAfter: number;
  /** For the night before: what to keep clear of. */
  avoid: Effect[];
}

/** Whole local days from `a`'s day to `b`'s (DST days are 23 or 25 hours, hence round). */
function daysBetween(a: number, b: number, timeZone: string): number {
  return Math.round((startOfDay(b, timeZone) - startOfDay(a, timeZone)) / (24 * HOUR_MS));
}

/** Tiring, drinking, late, or long: too much in the days before an exam. */
function isBig(impact: DateImpact): boolean {
  const length = impact.end - impact.start;
  if (impact.effects.length > 0 || length >= BIG_MS) return true;
  return impact.strain === "moderate" || impact.strain === "heavy";
}

/** Light and short: fine even the day before. Unknown strain counts as light. */
function isSmall(impact: DateImpact): boolean {
  const length = impact.end - impact.start;
  const light = impact.strain === null || impact.strain === "none" || impact.strain === "light";
  return light && impact.effects.length === 0 && length <= SMALL_MS;
}

const RANK: Record<ClashKind, number> = { nightBefore: 0, prepDayBefore: 1, prep: 2, recovery: 3 };

/**
 * What the planned event, on the date `impact` is for, runs into among your
 * important events (`mine`). Empty when nothing does.
 */
export function importantClashes(
  impact: DateImpact,
  mine: LabelledEvent[],
  timeZone: string,
): ImportantClash[] {
  const lastDay = impact.end - 1 - NIGHT_ENDS_HOUR * HOUR_MS;
  const clashes: ImportantClash[] = [];
  for (const event of mine) {
    const { label } = event;
    if (label.importance !== "high" && label.importance !== "critical") continue;
    // Before the planned event ends, or during it: the calendar check under
    // the card says that already.
    if (event.start < impact.end) continue;
    const critical = label.importance === "critical";
    const daysAfter = daysBetween(lastDay, event.start, timeZone);
    const found: ImportantClash[] = [];

    const avoid = label.avoidBefore.filter((a) => impact.effects.includes(a));
    if (avoid.length > 0 && event.start - impact.end <= NIGHT_BEFORE_MS) {
      found.push({
        kind: "nightBefore",
        severity: critical ? "critical" : "warning",
        event,
        daysAfter,
        avoid,
      });
    }
    if (label.prepDays >= 1 && daysAfter >= 1 && daysAfter <= label.prepDays) {
      if (daysAfter === 1 && critical && !isSmall(impact)) {
        found.push({ kind: "prepDayBefore", severity: "critical", event, daysAfter, avoid: [] });
      } else if (isBig(impact)) {
        found.push({ kind: "prep", severity: "warning", event, daysAfter, avoid: [] });
      }
    }
    if (impact.recoveryDays >= 1 && daysAfter >= 1 && daysAfter <= impact.recoveryDays) {
      found.push({ kind: "recovery", severity: "warning", event, daysAfter, avoid: [] });
    }

    const strongest = found.sort(
      (a, b) =>
        (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1) ||
        RANK[a.kind] - RANK[b.kind],
    )[0];
    if (strongest) clashes.push(strongest);
  }
  return clashes.sort(
    (a, b) =>
      (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1) ||
      a.event.start - b.event.start,
  );
}
