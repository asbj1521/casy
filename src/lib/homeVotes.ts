import type { SuggestedEvent } from "@/api/events";
import type { GridItem } from "@/lib/monthGrid";
import { sectionEvents } from "@/lib/myEvents";
import { upcomingDates, type VoteEvent } from "@/lib/vote";

/**
 * What the phone's home page shows of Casy's own events (#172): the votes
 * waiting for your answer, their dates pencilled into their days, and the
 * events decided, as chips of their own, so a date that has just flown into
 * its day stays there. Plain functions, so the page and the tests agree.
 */

/** The month items' calendar id for Casy's events, drawn in Casy's orange. */
export const CASY_CALENDAR = "casy";

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
    const you = e.invitees.find((i) => i.isYou)?.profileId;
    const chosen = e.candidates.find((c) => c.id === e.currentDate.id);
    if (you && chosen?.answers[you] === "declined") return [];
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
