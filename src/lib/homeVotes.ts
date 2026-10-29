import type { SuggestedEvent } from "@/api/events";
import type { GridItem } from "@/lib/monthGrid";
import { sectionEvents, type DatedEvent } from "@/lib/myEvents";
import { upcomingDates, type VoteEvent } from "@/lib/vote";

/**
 * What the phone's home page shows of Casy's own events (#172): the votes
 * waiting for your answer, their dates pencilled into their days, and the
 * events decided, as chips of their own, so a date that has just flown into
 * its day stays there. Plain functions, so the page and the tests agree.
 */

/** The month items' calendar id for Casy's events, drawn in Casy's orange. */
export const CASY_CALENDAR = "casy";
/** Casy's orange, as the month's calendar colours are written. */
export const CASY_RGB = "234, 88, 12";

/** You said no to the date an event was decided on: it isn't yours to show. */
function saidNo(e: DatedEvent): boolean {
  const you = e.invitees.find((i) => i.isYou)?.profileId;
  const chosen = e.candidates.find((c) => c.id === e.currentDate.id);
  return !!you && chosen?.answers[you] === "declined";
}

/** Votes with dates waiting for your answer, soonest first (My events' "toSwipe"). */
export function waitingVotes(events: SuggestedEvent[], now = Date.now()): VoteEvent[] {
  return sectionEvents(events, now).toSwipe;
}

/** Each waiting vote's dates still to come, pencilled in under its title. */
export function pencilItems(
  votes: VoteEvent[],
  titleOf: (event: VoteEvent) => string,
  now = Date.now(),
): GridItem[] {
  return votes.flatMap((vote) =>
    upcomingDates(vote, now).map((d) => ({
      calendarId: CASY_CALENDAR,
      start: Date.parse(d.start),
      end: Date.parse(d.end),
      label: titleOf(vote),
      pencil: true,
    })),
  );
}

/**
 * The events Casy has decided that you are going to, still to come, as month
 * items under their title. One your calendar already holds at exactly that
 * time is left out: that is the copy Casy wrote into it, already drawn.
 */
export function scheduledItems(
  events: SuggestedEvent[],
  calendarItems: GridItem[],
  titleOf: (event: SuggestedEvent) => string,
  now = Date.now(),
): GridItem[] {
  const taken = new Set(calendarItems.map((i) => `${i.start}/${i.end}`));
  return sectionEvents(events, now).scheduled.flatMap((e) => {
    const start = Date.parse(e.currentDate.start);
    const end = Date.parse(e.currentDate.end);
    if (saidNo(e)) return [];
    if (taken.has(`${start}/${end}`)) return [];
    return [{ calendarId: CASY_CALENDAR, start, end, label: titleOf(e) }];
  });
}

/**
 * The events decided since this device last looked (`seen`: their ids), still
 * to come: each flies into its day once, soonest first.
 */
export function newlyDecided(
  events: SuggestedEvent[],
  seen: ReadonlySet<string>,
  now = Date.now(),
) {
  return sectionEvents(events, now).scheduled.filter((e) => !seen.has(e.id));
}

/**
 * Casy's own events on a day (a local midnight, as `dayOf` makes of a date),
 * for the day's list: the agreed ones you are going to, then the dates of
 * votes waiting for your answer.
 */
export function casyOnDay(
  events: SuggestedEvent[],
  day: number,
  dayOf: (iso: string) => number,
  now = Date.now(),
): { event: SuggestedEvent; start: string; end: string; vote: boolean }[] {
  const sections = sectionEvents(events, now);
  const agreed = sections.scheduled
    .filter((e) => !saidNo(e) && dayOf(e.currentDate.start) === day)
    .map((e) => ({ event: e, start: e.currentDate.start, end: e.currentDate.end, vote: false }));
  const votes = sections.toSwipe.flatMap((v) =>
    upcomingDates(v, now)
      .filter((d) => dayOf(d.start) === day)
      .map((d) => ({ event: v as SuggestedEvent, start: d.start, end: d.end, vote: true })),
  );
  return [...agreed, ...votes];
}
