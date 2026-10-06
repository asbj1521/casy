/**
 * How the My events page sorts suggested events. Pure, so the rules (which
 * section an event belongs in, who it's waiting for) are tested rather than
 * trusted to the page.
 */
import { needsYourAnswer, type SuggestedEvent } from "@/api/events";
import { isVote, upcomingDates, type VoteEvent } from "@/lib/vote";

/** An event with a date on offer, or, once scheduled, the date it's on. */
export type DatedEvent = SuggestedEvent & {
  currentDate: NonNullable<SuggestedEvent["currentDate"]>;
};

export interface EventSections {
  /** A vote with dates you haven't answered yet (#74): the swiping to do. */
  toSwipe: VoteEvent[];
  /** Pending, and you haven't answered the current date yet. */
  needsAnswer: DatedEvent[];
  /** A vote you've answered: waiting for the others, or for the suggester to choose. */
  voting: VoteEvent[];
  /** Pending, you've said yes, others haven't answered. */
  waiting: DatedEvent[];
  /** Everyone accepted, and the date hasn't passed. */
  scheduled: DatedEvent[];
  /** Past, or no date left. Cancelled events aren't kept anywhere. */
  closed: SuggestedEvent[];
}

const hasDate = (e: SuggestedEvent): e is DatedEvent => e.currentDate !== null;
const bySoonest = (a: DatedEvent, b: DatedEvent) =>
  Date.parse(a.currentDate.start) - Date.parse(b.currentDate.start);

export function sectionEvents(events: SuggestedEvent[], now = Date.now()): EventSections {
  const sections: EventSections = {
    toSwipe: [],
    needsAnswer: [],
    voting: [],
    waiting: [],
    scheduled: [],
    closed: [],
  };
  const firstDate = new Map<string, number>();
  for (const e of events) {
    // A cancelled event has nothing left to act on or learn from, so it's
    // dropped rather than filed away to look at later.
    if (e.status === "cancelled") continue;
    // A vote still being answered has no date yet, only dates to come; with
    // none left, it's over.
    if (isVote(e) && e.status === "pending") {
      const dates = upcomingDates(e, now);
      if (dates.length === 0) sections.closed.push(e);
      else {
        firstDate.set(e.id, Date.parse(dates[0].start));
        (needsYourAnswer(e, now) ? sections.toSwipe : sections.voting).push(e);
      }
      continue;
    }
    if (!hasDate(e) || Date.parse(e.currentDate.end) <= now) sections.closed.push(e);
    else if (e.status === "scheduled") sections.scheduled.push(e);
    else if (e.status !== "pending") sections.closed.push(e);
    else if (e.invitees.some((i) => i.isYou && i.response === null)) sections.needsAnswer.push(e);
    else sections.waiting.push(e);
  }
  // Soonest first where there's a date to act on; most recent first for the rest.
  const byFirstDate = (a: VoteEvent, b: VoteEvent) =>
    (firstDate.get(a.id) ?? 0) - (firstDate.get(b.id) ?? 0);
  sections.toSwipe.sort(byFirstDate);
  sections.voting.sort(byFirstDate);
  sections.needsAnswer.sort(bySoonest);
  sections.waiting.sort(bySoonest);
  sections.scheduled.sort(bySoonest);
  sections.closed.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return sections;
}

/** Which section an event is in: what it needs from you, or that it's over. */
export type EventStage = keyof EventSections;

/** The sections in the order the page shows them. */
export const STAGES: readonly EventStage[] = [
  "toSwipe",
  "needsAnswer",
  "voting",
  "waiting",
  "scheduled",
  "closed",
];

/** Every event the page shows, section by section, each with its section. */
export type StagedEvent =
  | { stage: "toSwipe"; event: VoteEvent }
  | { stage: "voting"; event: VoteEvent }
  | { stage: "needsAnswer" | "waiting" | "scheduled"; event: DatedEvent }
  | { stage: "closed"; event: SuggestedEvent };

export function eventsInOrder(sections: EventSections): StagedEvent[] {
  return STAGES.flatMap((stage) =>
    sections[stage].map((event) => ({ stage, event }) as StagedEvent),
  );
}

/** The people who haven't answered the current date yet (never you). */
export function waitingOn(event: SuggestedEvent): string[] {
  return event.invitees.filter((i) => !i.isYou && i.response === null).map((i) => i.name);
}
