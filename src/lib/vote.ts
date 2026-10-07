/**
 * Votes (#74): an event that offers several dates at once, which everyone
 * answers by swiping through them. Pure, so the rules are tested rather than
 * trusted to the screens.
 *
 * The database decides a vote (decide_vote, in the participants migration):
 * once everyone required has answered every date still to come, or the
 * deadline passes. Without "at least N" (#89): the date no required member
 * declined, with the fewest "maybe", earliest first. With it: a date at least
 * N required members can make (yes or "maybe"), the one most people can make,
 * then the fewest "maybe", then the earliest. Optional members never block a
 * date. `leader` repeats that rule so the screens can say which date is
 * ahead; the database's choice is the one that counts.
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

/** True if this invitee is optional (#89): invited, but never deciding. */
export function isOptional(event: SuggestedEvent, profileId: string): boolean {
  return event.settings.people?.optional.includes(profileId) ?? false;
}

/**
 * The answers of the people still invited (someone who left no longer
 * counts); `required` only, the members who decide.
 */
export function tally(
  date: CandidateDate,
  event: SuggestedEvent,
  { required = false }: { required?: boolean } = {},
): Tally {
  const counts: Tally = { accepted: 0, maybe: 0, declined: 0, missing: 0 };
  for (const person of event.invitees) {
    if (required && isOptional(event, person.profileId)) continue;
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

/** True once everyone required has answered every date still to come. */
export function allAnswered(event: VoteEvent, now = Date.now()): boolean {
  return upcomingDates(event, now).every((c) => tally(c, event, { required: true }).missing === 0);
}

const byStart = (a: CandidateDate, b: CandidateDate) => Date.parse(a.start) - Date.parse(b.start);

/**
 * The date the vote would choose as things stand (see the top). Null if no
 * date qualifies: every one has a required "no", or, with "at least N",
 * none has N required yes or "maybe" yet.
 */
export function leader(event: VoteEvent, now = Date.now()): CandidateDate | null {
  const atLeast = event.settings.people?.atLeast;
  const ranked = upcomingDates(event, now).map((date) => ({
    date,
    t: tally(date, event, { required: true }),
    all: tally(date, event),
  }));
  if (atLeast === undefined) {
    const open = ranked.filter(({ t }) => t.declined === 0);
    open.sort((a, b) => a.t.maybe - b.t.maybe || byStart(a.date, b.date));
    return open[0]?.date ?? null;
  }
  const enough = ranked.filter(({ t }) => t.accepted + t.maybe >= atLeast);
  enough.sort(
    (a, b) =>
      b.all.accepted + b.all.maybe - (a.all.accepted + a.all.maybe) ||
      a.t.maybe - b.t.maybe ||
      byStart(a.date, b.date),
  );
  return enough[0]?.date ?? null;
}

/**
 * What the suggester is pointed to when they choose: the leader if there is
 * one, else the date the fewest declined, then the fewest "maybe", then the
 * earliest.
 */
export function bestPick(event: VoteEvent, now = Date.now()): CandidateDate | null {
  const ranked = upcomingDates(event, now)
    .map((date) => ({ date, t: tally(date, event, { required: true }) }))
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

/** The required people (never you) who still owe an answer on some date to come. */
export function stillToAnswer(event: VoteEvent, now = Date.now()): string[] {
  const dates = upcomingDates(event, now);
  return event.invitees
    .filter(
      (i) =>
        !i.isYou &&
        !isOptional(event, i.profileId) &&
        dates.some((c) => c.answers[i.profileId] === undefined),
    )
    .map((i) => i.name);
}
