/**
 * The App Review demo world (#142), as plain data and dates: who is in it,
 * where their calendars are, and when the two events are. demo.ts builds it
 * on the live project; this file has no network and no secrets, so CI tests
 * it (plan_test.ts) against the feeds in public/review/.
 *
 * Everything here is made up. The repo is public: no real people, no real
 * addresses (the script makes the addresses from the owner's own email at
 * run time).
 */
import { DEFAULT_ZONE, offsetMinutes, wallClockToUtc } from "../functions/_shared/timezones.ts";

export type PersonKey = "alex" | "sara" | "jonas";

export interface DemoPerson {
  key: PersonKey;
  /** The name the group sees. */
  name: string;
  /** The plus-alias of the owner's email this account uses. */
  alias: string;
}

/** Alex is the account the reviewer signs in as; Sara and Jonas are its friends. */
export const PEOPLE: readonly DemoPerson[] = [
  { key: "alex", name: "Alex", alias: "casy-review" },
  { key: "sara", name: "Sara", alias: "casy-sara" },
  { key: "jonas", name: "Jonas", alias: "casy-jonas" },
];

export const GROUP = {
  name: "Friday dinners",
  description: "Dinner together about once a month",
};

/** Where casy.app serves each person's sample calendar (public/review/). */
export function feedUrl(key: PersonKey, origin = "https://casy.app"): string {
  return `${origin}/review/${key}.ics`;
}

/**
 * `owner@gmail.com` with `+alias` added before the @ (any plus-part already
 * there is replaced), so every demo email lands in the owner's own inbox and
 * none bounces. Null for something that isn't an email address.
 */
export function demoEmail(ownerEmail: string, alias: string): string | null {
  const match = /^([^@\s+]+)(?:\+[^@\s]*)?@([^@\s]+\.[^@\s]+)$/.exec(ownerEmail.trim());
  if (!match) return null;
  return `${match[1]}+${alias}@${match[2]}`.toLowerCase();
}

export interface DemoDate {
  start: string;
  end: string;
}

/** The settings the scheduler would have sent for each event (the shape isEventSettings checks). */
export const VOTE_SETTINGS = {
  kind: "single",
  durationMinutes: 180,
  startHour: 19,
  allowedDays: [5],
};
export const AGREED_SETTINGS = {
  kind: "single",
  durationMinutes: 120,
  startHour: 11,
  allowedDays: [0],
};

export const VOTE = {
  title: "Dinner at Sara's",
  place: "Sara's place",
  settings: VOTE_SETTINGS,
};

export const AGREED = {
  title: "Sunday brunch",
  place: "Cafe Nord",
  settings: AGREED_SETTINGS,
};

const FRIDAY = 5;
const SUNDAY = 0;

/**
 * The vote Sara sends: the first three Fridays at least a week away,
 * 19:00 to 22:00 Danish time. A week ahead so the dates are still open
 * however long the review takes, and no deadline (the script sends none),
 * so it can't settle itself before the reviewer answers.
 */
export function voteDates(now: number): DemoDate[] {
  const first = nextWeekday(now, FRIDAY, 7);
  return [0, 7, 14].map((extra) => wallClockSlot(addDays(first, extra), 19, 22));
}

/** The event already agreed on: a Sunday two weeks or more away, 11:00 to 13:00. */
export function agreedDate(now: number): DemoDate {
  return wallClockSlot(nextWeekday(now, SUNDAY, 14), 11, 13);
}

/** A calendar day in Danish time, as numbers (month 1-12). */
interface Day {
  year: number;
  month: number;
  day: number;
}

/** Today in Danish time. */
function danishToday(now: number): Day {
  const local = new Date(now + offsetMinutes(DEFAULT_ZONE, now) * 60_000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

/** A calendar step: Date.UTC rolls the month and year over, and no daylight saving is involved. */
function addDays(d: Day, days: number): Day {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function weekday(d: Day): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

/** The first `dow` (0 = Sunday) at least `minDays` days after today. */
function nextWeekday(now: number, dow: number, minDays: number): Day {
  let d = addDays(danishToday(now), minDays);
  while (weekday(d) !== dow) d = addDays(d, 1);
  return d;
}

function wallClockSlot(d: Day, startHour: number, endHour: number): DemoDate {
  return {
    start: wallClockToUtc(DEFAULT_ZONE, d.year, d.month, d.day, startHour).toISOString(),
    end: wallClockToUtc(DEFAULT_ZONE, d.year, d.month, d.day, endHour).toISOString(),
  };
}
