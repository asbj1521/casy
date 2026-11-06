/** The welcome animation's made-up people, month and vote (#228). */

import type { VoteEvent } from "@/lib/vote";
import type { GridItem } from "@/lib/monthGrid";
import { addDays, APP_TIME_ZONE, dayOfWeek, localDate, startOfMonth, wallTime } from "@/lib/zone";

export const TZ = APP_TIME_ZONE;

/** The made-up group, the same name in both languages. */
export const GROUP_NAME = "Uni-Gruppen";

/**
 * You first, then the five friends whose paper calendars land on your phone.
 * One colour each, the same on their face, their pen and their bars, so you can
 * follow a person from the group to the calendar.
 */
export const PEOPLE = [
  { id: "you", name: "", color: "0, 122, 255" },
  { id: "philip", name: "Philip", color: "52, 199, 89" },
  { id: "emilie", name: "Emilie", color: "175, 82, 222" },
  { id: "elias", name: "Elias", color: "255, 149, 0" },
  { id: "claes", name: "Claes", color: "255, 59, 48" },
  { id: "simon", name: "Simon", color: "48, 176, 199" },
];
export const FRIENDS = PEOPLE.slice(1);

export const colorOf = (id: string) => PEOPLE.find((p) => p.id === id)?.color ?? "";

/** The example month: next month, so the days in it are all still to come. */
export const demoMonth = (now: number): number => startOfMonth(now, TZ, 1);

/**
 * Who is busy when: every day has someone busy except three Fridays, which are
 * the only days that light up, so what the animation says is true of what it
 * shows. Never more than three on a day, as many as a day's rows hold.
 */
export function demoPlan(month: number): { free: number[]; items: GridItem[][] } {
  const end = startOfMonth(month, TZ, 1);
  const days: number[] = [];
  for (let d = month; d < end; d = addDays(d, 1, TZ)) days.push(d);
  const free = days.filter((d) => dayOfWeek(d, TZ) === 5).slice(1, 4);
  const items: GridItem[][] = PEOPLE.map(() => []);
  days.forEach((d, i) => {
    if (free.includes(d)) return;
    const busy = new Set([i % 6]);
    if (i % 3 !== 2) busy.add((i + 2) % 6);
    if (i % 5 === 0) busy.add((i + 3) % 6);
    for (const who of busy) {
      items[who].push({
        calendarId: PEOPLE[who].id,
        start: d,
        end: addDays(d, 1, TZ),
        label: "",
      });
    }
  });
  return { free, items };
}

const iso = (day: number, hour: number) => {
  const d = localDate(day, TZ);
  return new Date(wallTime(d.year, d.month, d.day, hour, TZ)).toISOString();
};

/** The hours of the event in the vote. */
export const EVENT_HOURS = { from: 19, to: 22 };

/**
 * The vote on the free days, for the app's real card (CardFace), with what it
 * reads filled in; nothing is ever sent anywhere. The friends' answers so far:
 * most are in, as they are when you get to it.
 */
export function demoVote(free: number[], title: string): VoteEvent {
  const others = FRIENDS.map((f) => f.id);
  return {
    id: "welcome",
    group: { id: "welcome", name: GROUP_NAME },
    title,
    place: null,
    note: null,
    settings: { kind: "single", startHour: EVENT_HOURS.from, durationMinutes: 180 },
    status: "pending",
    mode: "vote",
    invitees: FRIENDS.map((f) => ({
      profileId: f.id,
      name: f.name,
      isYou: false,
      response: null,
    })),
    candidates: free.map((day, i) => ({
      id: String(day),
      start: iso(day, EVENT_HOURS.from),
      end: iso(day, EVENT_HOURS.to),
      answers: Object.fromEntries(
        others.filter((_, k) => (k + i) % 5 !== 4).map((id) => [id, "accepted" as const]),
      ),
    })),
  } as unknown as VoteEvent;
}
