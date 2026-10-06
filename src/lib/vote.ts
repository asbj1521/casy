/**
 * Votes (#74): an event that offers several dates at once, which everyone
 * answers by swiping through them. Pure, so the rules are tested rather than
 * trusted to the screens.
 *
 * The database decides a vote (decide_vote, in the swipe_dates migration):
 * once everyone still invited has answered every date still to come, or the
 * deadline passes, the date nobody declined with the fewest "maybe", earliest
 * first, is chosen. `leader` repeats that rule so the screens can say which
 * date is ahead; the database's choice is the one that counts.
 */
import type { CandidateDate, SuggestedEvent } from "@/api/events";

/** An event offering several dates to vote on. */
export type VoteEvent = SuggestedEvent & { mode: "vote" };

export function isVote(event: SuggestedEvent): event is VoteEvent {
  return event.mode === "vote";
}

/** How one date stands: how many said each answer, and how many have yet to. */
export interface Tally {
  accepted: number;
  maybe: number;
  declined: number;
  missing: number;
}

/** The answers of the people still invited (someone who left no longer counts). */
export function tally(date: CandidateDate, event: SuggestedEvent): Tally {
  const counts: Tally = { accepted: 0, maybe: 0, declined: 0, missing: 0 };
  for (const person of event.invitees) {
    const answer = date.answers[person.profileId];
    if (answer) counts[answer]++;
    else counts.missing++;
  }
  return counts;
}

/** The dates that can still be answered: those not yet begun, soonest first. */
export function upcomingDates(event: VoteEvent, now = Date.now()): CandidateDate[] {
  return event.candidates.filter((c) => Date.parse(c.start) > now);
}

/** Your profile id in this event, if you are invited. */
function yourId(event: SuggestedEvent): string | null {
  return event.invitees.find((i) => i.isYou)?.profileId ?? null;
}

/** Where your answering starts: the first upcoming date you haven't answered, or -1. */
export function firstUnanswered(event: VoteEvent, now = Date.now()): number {
  const you = yourId(event);
  return upcomingDates(event, now).findIndex((c) => !you || c.answers[you] === undefined);
}

/** True once everyone still invited has answered every date still to come. */
export function allAnswered(event: VoteEvent, now = Date.now()): boolean {
  return upcomingDates(event, now).every((c) => tally(c, event).missing === 0);
}

const byStart = (a: CandidateDate, b: CandidateDate) => Date.parse(a.start) - Date.parse(b.start);

/**
 * The date the vote would choose as things stand: nobody declined it, the
 * fewest "maybe", earliest first. Null if every upcoming date has a decline.
 */
export function leader(event: VoteEvent, now = Date.now()): CandidateDate | null {
  const open = upcomingDates(event, now)
    .map((date) => ({ date, t: tally(date, event) }))
    .filter(({ t }) => t.declined === 0);
  open.sort((a, b) => a.t.maybe - b.t.maybe || byStart(a.date, b.date));
  return open[0]?.date ?? null;
}

/**
 * What the suggester is pointed to when they choose: the leader if there is
 * one, else the date the fewest declined, then the fewest "maybe", then the
 * earliest.
 */
export function bestPick(event: VoteEvent, now = Date.now()): CandidateDate | null {
  const ranked = upcomingDates(event, now)
    .map((date) => ({ date, t: tally(date, event) }))
    .sort(
      (a, b) => a.t.declined - b.t.declined || a.t.maybe - b.t.maybe || byStart(a.date, b.date),
    );
  return ranked[0]?.date ?? null;
}

/**
 * Where a pending vote stands for you:
 *
 * - `answer`: there are dates you haven't answered.
 * - `waiting`: you have answered them all; others haven't, or the deadline is still ahead.
 * - `choose`: everyone has answered (or the deadline passed) and every date
 *   has a decline, so the date is yours to choose, as the suggester.
 * - `waitingForChoice`: the same, for everyone else: the suggester chooses.
 */
export type VoteStage = "answer" | "waiting" | "choose" | "waitingForChoice";

export function voteStage(event: VoteEvent, now = Date.now()): VoteStage {
  const you = yourId(event);
  if (you && upcomingDates(event, now).some((c) => c.answers[you] === undefined)) return "answer";
  const due =
    allAnswered(event, now) || (event.answerBy !== null && Date.parse(event.answerBy) <= now);
  // Due with a date nobody declined: the database decides it on the next
  // look, so it's still "waiting" until the list says scheduled.
  if (!due || leader(event, now)) return "waiting";
  return event.createdBy.isYou ? "choose" : "waitingForChoice";
}

/** The people (never you) who still owe an answer on some date to come. */
export function stillToAnswer(event: VoteEvent, now = Date.now()): string[] {
  const dates = upcomingDates(event, now);
  return event.invitees
    .filter((i) => !i.isYou && dates.some((c) => c.answers[i.profileId] === undefined))
    .map((i) => i.name);
}
