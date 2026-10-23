/**
 * Tell Casy (#116), the browser's half: what a person told Casy that is in
 * no calendar ("I'm home all of December"), kept as entries of their own
 * (supabase/functions/_shared/entries.ts, which this mirrors). They are busy
 * time of their own and work for every provider, since they need no calendar
 * content.
 *
 * They reach other people's searches through the groups function. Here they
 * are drawn on My calendar as a built-in "Casy" calendar, like the holidays
 * (no account behind it, no tick: an entry is deleted, not hidden), and they
 * count as busy time in the searches the browser runs on your own calendar
 * (busyFromCalendars).
 */
import type { Lang } from "@/i18n/locale";
import type { OverviewBlock } from "@/lib/calendarOverview";
import { formatDate, formatDaySpan, formatTime } from "@/lib/format";
import { APP_TIME_ZONE, startOfDay } from "@/lib/zone";
import type { BusyInterval } from "@/types";

/**
 * "busy": time you can't meet (blocks a meeting). "away": you are somewhere
 * else for a stretch (blocks meetings and trips alike, like a calendar set to
 * "never skip").
 */
type EntryKind = "busy" | "away";

/** An entry as the page shows and sends it: instants in UTC. */
export interface CasyEntry {
  kind: EntryKind;
  /** Short and plain, as the person sees it in their list. */
  label: string;
  /** ISO 8601 UTC, inclusive. */
  start: string;
  /** ISO 8601 UTC, exclusive. */
  end: string;
  /** Whole Danish days (local midnight to local midnight). */
  allDay: boolean;
}

/** A saved entry. */
export interface StoredEntry extends CasyEntry {
  id: string;
}

/** The built-in calendar the entries are drawn in: no row in the database. */
export const CASY_CALENDAR_ID = "builtin:casy-entries";

/** "r, g, b" for the Casy calendar: the app's own orange, which no category uses. */
export const CASY_RGB = "234, 88, 12";

/** The entries as blocks of the Casy calendar, named by their labels. */
export function entryBlocks(entries: StoredEntry[]): OverviewBlock[] {
  return entries.map((e) => ({
    calendarId: CASY_CALENDAR_ID,
    start: e.start,
    end: e.end,
    details: { title: e.label, location: "", notes: "" },
  }));
}

/**
 * The entries as the engine's busy time, the way the groups function sends
 * them for a real group: a stretch away is never skipped, trips included;
 * busy time is an ordinary block.
 */
export function entryBusy(entries: StoredEntry[]): BusyInterval[] {
  return entries.map((e) => ({
    start: e.start,
    end: e.end,
    title: e.label,
    ...(e.kind === "away" ? { priority: "never" as const } : {}),
  }));
}

/**
 * When an entry is, in Danish time as everything in Casy: "Mon 12 Oct to Mon
 * 19 Oct" for whole days, a single day as just that day, "Fri 16 Oct ·
 * 18:00-22:00" for hours, and across midnight both ends in full.
 */
export function entryWhen(entry: CasyEntry, lang: Lang): string {
  const last = new Date(Date.parse(entry.end) - 1).toISOString();
  const oneDay =
    startOfDay(Date.parse(entry.start), APP_TIME_ZONE) ===
    startOfDay(Date.parse(last), APP_TIME_ZONE);
  if (entry.allDay) {
    return oneDay ? formatDate(entry.start, lang) : formatDaySpan(entry.start, entry.end, lang);
  }
  if (oneDay) {
    return `${formatDate(entry.start, lang)} · ${formatTime(entry.start)}-${formatTime(entry.end)}`;
  }
  const to = lang === "da" ? "til" : "to";
  return `${formatDate(entry.start, lang)} ${formatTime(entry.start)} ${to} ${formatDate(entry.end, lang)} ${formatTime(entry.end)}`;
}
