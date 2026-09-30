/**
 * The shapes the scheduling engine works on (src/lib/availability.ts). Real
 * groups (src/api/groups.ts) and the made-up example groups (src/api/mockData.ts)
 * both arrive in them, so the engine never knows which it is looking at.
 *
 * Time convention: all instants are stored as ISO 8601 strings in UTC
 * (e.g. "2026-06-20T14:00:00.000Z"): a busy block is a moment in time no
 * matter where anyone is. What *is* local is how people describe a meeting,
 * "18:00 on a Friday", so those settings are read in the event's time zone
 * (see src/lib/zone.ts) and turned into instants before any comparison.
 */

/** Which kind of account a calendar came from. */
export type CalendarProvider = "google" | "outlook" | "apple" | "ics";

/**
 * What its owner says a calendar is for, set on My calendar. Work and school
 * carry over to its busy blocks as their category (EventCategory).
 */
export type CalendarPurpose = "work" | "school" | "personal" | "other";

/**
 * What a busy block is. Only "work" and "school" change anything: they are
 * time you could take off for a trip (isSoftBlock). Real blocks carry one of
 * those two or none, from their calendar's purpose; the example groups use
 * the rest to make their generated calendars read like real ones.
 */
export type EventCategory =
  "work" | "school" | "social" | "health" | "travel" | "personal" | "family";

/**
 * How much a calendar's busy time matters to its owner, set per calendar:
 *
 * - "skip":   happy to skip it for anything (a lecture, training). It never
 *             blocks a search; a date that needs it skipped says so.
 * - "normal": the default and the original rules: blocks a meeting; for a
 *             trip, work/school needs time off and short plans don't count.
 * - "never":  never skipped: blocks meetings and trips alike (an exam, a
 *             shift that can't move).
 *
 * Per calendar rather than per event because event titles are never stored,
 * so one lecture can't be told from another.
 */
export type CalendarPriority = "skip" | "normal" | "never";

/**
 * A single block of time during which someone is unavailable.
 *
 * This is deliberately *just* a time range — no event title, location, or
 * attendees. Both Google and Outlook expose a "free/busy" API that returns
 * exactly this and nothing more, which is both a privacy win and less data to
 * handle. `start` is inclusive, `end` is exclusive.
 */
export interface BusyInterval {
  /** ISO 8601 UTC instant, inclusive. */
  start: string;
  /** ISO 8601 UTC instant, exclusive. */
  end: string;
  /**
   * What to call it when asking you to take time off or skip it: your own
   * name for the calendar it came from, or a made-up title in an example
   * group. Never an event title, since none are stored.
   */
  title?: string;
  category?: EventCategory;
  /** Its calendar's priority; omitted means "normal". */
  priority?: CalendarPriority;
  /**
   * True for the times nobody is free (Christmas, New Year: holidayBlocks.ts),
   * given to everyone alike. Not anyone's own plans, so the warnings about a
   * meeting's edges (earlyMorning.ts) leave them out.
   */
  holiday?: boolean;
}

/** A person invited to an event, plus their aggregated busy time. */
export interface Participant {
  profileId: string;
  name: string;
  /** Merged busy intervals across all of this participant's calendars. */
  busy: BusyInterval[];
}

/**
 * A named circle of friends a user schedules with — "The highschool group",
 * "Work team", etc. One profile can belong to many groups, and an event is
 * always created for exactly one group.
 */
export interface FriendGroup {
  id: string;
  name: string;
  participants: Participant[];
}

/** A single meeting to find a time for: who, how long, and where to look. */
export interface MeetingSearch {
  participants: Participant[];
  /** How long the meeting needs to be, in minutes. */
  durationMinutes: number;
  /** The window to search within, as ISO 8601 UTC instants. */
  searchStart: string;
  searchEnd: string;
  /**
   * IANA zone the constraints' hours and weekdays are read in, e.g.
   * "Europe/Copenhagen". Required, so no search silently falls back to UTC.
   */
  timeZone: string;
  /** Optional constraints on what counts as an acceptable slot. */
  constraints?: SchedulingConstraints;
}

/**
 * Optional rules that narrow down what counts as a valid meeting slot.
 * Everything here is optional so the engine has sensible defaults.
 */
export interface SchedulingConstraints {
  /**
   * Earliest local hour of day a meeting may start, 0-23 (fractions allowed).
   * Defaults to 0.
   */
  earliestHour?: number;
  /**
   * Latest local hour of day a meeting may *end*, 1-24 — or beyond 24 to let the
   * window spill past midnight (e.g. 26 = 02:00 the next day, for night events).
   * Defaults to 24.
   */
  latestHour?: number;
  /**
   * Which days of the week may host the event, as local day-of-week values
   * (0 = Sunday … 6 = Saturday). A window is kept if it *starts* on an allowed
   * day, so a Friday night out that ends 02:00 Saturday counts as Friday.
   * Omitted = all seven days.
   */
  allowedDays?: number[];
}

/** A concrete proposed meeting time. */
export interface TimeSlot {
  /** ISO 8601 UTC instant. */
  start: string;
  /** ISO 8601 UTC instant. */
  end: string;
}
