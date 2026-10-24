/**
 * Suggested events, backed by the `events` Edge Function.
 *
 * Someone finds a date on the scheduling page and suggests it with a few
 * more good dates (a vote, #74): everyone in the group, the suggester too,
 * swipes through them once on My events, and the date that suits everyone
 * best is chosen (src/lib/vote.ts explains the rule).
 *
 * Events suggested before votes offered one date at a time ("single"); that
 * flow was retired (#159). Scheduled and past ones are still listed.
 */
import { queryOptions } from "@tanstack/react-query";

import type { EventImpact } from "@/api/eventProfile";
import type { EventSettings } from "@/lib/eventSearch";
import { callFunction } from "@/lib/supabaseFunctions";
import { currentMessages } from "@/i18n/current";

type EventStatus = "pending" | "scheduled" | "no_date" | "cancelled";
/** How a date is offered: one at a time, or several to vote on (#74). */
type EventMode = "single" | "vote";
/**
 * An answer to a date. "maybe" (I can, but would rather not) only exists in
 * a vote: it counts as a yes, but a date with fewer of them wins.
 */
export type EventResponse = "accepted" | "maybe" | "declined";

/** One of a vote's dates, with the answers so far, by profile id. */
export interface CandidateDate {
  id: string;
  start: string;
  end: string;
  /**
   * How well the date suits the group by everyone's important events, 0 to
   * 100 (#119): one number for the whole group, never whose events cost what.
   * Null or missing when it was not scored.
   */
  matchScore?: number | null;
  answers: Record<string, EventResponse>;
}

export interface EventInvitee {
  profileId: string;
  name: string;
  isYou: boolean;
  /** Their answer to the current date; null means they haven't answered yet. */
  response: EventResponse | null;
}

export interface SuggestedEvent {
  id: string;
  group: { id: string; name: string };
  title: string;
  /** Where and what to know (#84), as the suggester typed them; null if not given. */
  place: string | null;
  note: string | null;
  settings: EventSettings;
  status: EventStatus;
  mode: EventMode;
  /** A vote's deadline: after it, the dates are decided with the answers there are. */
  answerBy: string | null;
  /**
   * What the event is likely to cause for the people going (#113), whatever
   * the date; read it through impactOn (eventImpact.ts). Null or missing
   * when none came with it.
   */
  impact?: EventImpact | null;
  createdBy: { id: string | null; name: string; isYou: boolean };
  createdAt: string;
  updatedAt: string;
  /**
   * The date on offer (or, once scheduled, the date it's on). For a vote,
   * the date chosen: null until it is decided.
   */
  currentDate: { id: string; start: string; end: string } | null;
  /** A vote's dates, soonest first. Empty for a single-date event. */
  candidates: CandidateDate[];
  invitees: EventInvitee[];
  /** Dates offered earlier and turned down, oldest first. */
  declinedDates: { start: string; end: string; declinedBy: string }[];
  /**
   * Whether Casy has put it into your own primary calendar: "added",
   * "adding" (asked for, not there yet; `error` says why the last try
   * failed), or "gone" (added, then deleted from the calendar by hand, as
   * the last sync found). Null or missing: Casy hasn't been asked to.
   */
  myCalendar?:
    | { state: "added" }
    /** `onPhone`: the calendar is on a phone, whose app adds it when it runs (#105). */
    | { state: "adding"; error: string | null; onPhone?: boolean }
    | { state: "gone" }
    | null;
}

/**
 * The list as the site expects it, also from an events function deployed
 * before votes existed (no mode, no candidates).
 */
function withDefaults(events: SuggestedEvent[]): SuggestedEvent[] {
  return events.map((e) => ({
    ...e,
    place: e.place ?? null,
    note: e.note ?? null,
    mode: e.mode ?? "single",
    answerBy: e.answerBy ?? null,
    candidates: e.candidates ?? [],
  }));
}

/** Every call that changes an event answers with the fresh list, put in shape here. */
async function eventsCall<T extends object = object>(
  body: Record<string, unknown>,
  errorMessage: string,
): Promise<T & { events: SuggestedEvent[] }> {
  const answer = await callFunction<T & { events?: SuggestedEvent[] }>("events", {
    body,
    errorMessage,
  });
  return { ...answer, events: withDefaults(answer.events ?? []) };
}

export function eventsQueryKey(userId: string) {
  return ["events", userId] as const;
}

/**
 * Every event you were asked about. Not persisted across reloads like the
 * groups are: it carries other people's answers, and the badge can wait a
 * moment for a fresh copy.
 */
export function eventsQuery(userId: string) {
  return queryOptions({
    queryKey: eventsQueryKey(userId),
    queryFn: async (): Promise<SuggestedEvent[]> => {
      const { events } = await eventsCall({ action: "list" }, currentMessages().api.loadEvents);
      return events;
    },
    staleTime: 30_000,
  });
}

/** True if a vote is waiting for your answer on any date still to come. */
export function needsYourAnswer(event: SuggestedEvent, now = Date.now()): boolean {
  if (event.status !== "pending" || event.mode !== "vote") return false;
  const you = event.invitees.find((i) => i.isYou);
  if (!you) return false;
  return event.candidates.some(
    (c) => Date.parse(c.start) > now && c.answers[you.profileId] === undefined,
  );
}

/**
 * Suggest dates to a group, to vote on. Answers with the new event's id, so
 * the suggester can go straight on to answering the dates themselves.
 */
export async function suggestEvent(input: {
  groupId: string;
  title: string;
  settings: EventSettings;
  /**
   * The dates to vote on; on a phone each with the suggester's own answer,
   * given before sending (#101). A computer's suggester answers after.
   */
  dates: { start: string; end: string; answer?: "accepted" | "maybe" }[];
  /** Optional (#84); empty is the same as none. */
  place?: string;
  note?: string;
  /** How many days everyone has to answer (#99): 1 to 7. */
  answerDays?: number;
  /** What the event is likely to cause (#113), when the AI answered in time. */
  impact?: EventImpact;
}): Promise<{ events: SuggestedEvent[]; createdId: string }> {
  return await eventsCall<{ createdId: string }>(
    { action: "suggest", ...input },
    currentMessages().api.suggestEvent,
  );
}

/**
 * How well each of these dates would suit the group by the members'
 * important events (#119), one score from 0 to 100 per date in the order
 * given. The server combines what the members' phones shared and answers
 * only the scores, and how many members had shared anything (`counted`: with
 * none the scores say nothing); the scheduler asks before it picks a vote's
 * dates.
 */
export async function rankDates(input: {
  groupId: string;
  settings: EventSettings;
  /** What the planned event is likely to cause (#113); none scores on the timing alone. */
  profile: EventImpact | null;
  dates: { start: string; end: string }[];
}): Promise<{ scores: number[]; counted: number }> {
  return await callFunction<{ scores: number[]; counted: number }>("events", {
    body: { action: "rank-dates", ...input },
    errorMessage: currentMessages().api.loadEvents,
  });
}

/** Your answer to one of a vote's dates (or a changed one). */
export async function answerDate(
  proposalId: string,
  dateId: string,
  response: EventResponse,
): Promise<{
  events: SuggestedEvent[];
  outcome: "answered" | "scheduled" | "moved" | "undecided" | "no_date";
}> {
  return await eventsCall<{
    outcome: "answered" | "scheduled" | "moved" | "undecided" | "no_date";
  }>({ action: "answer", proposalId, dateId, response }, currentMessages().api.answerDate);
}

/** The suggester settles a vote on one of its dates. */
export async function chooseDate(
  proposalId: string,
  dateId: string,
): Promise<{ events: SuggestedEvent[] }> {
  return await eventsCall(
    { action: "choose", proposalId, dateId },
    currentMessages().api.chooseDate,
  );
}

/** The suggester changes the place and the note (#84); empty clears one. */
export async function editEventDetails(
  proposalId: string,
  details: { place: string; note: string },
): Promise<{ events: SuggestedEvent[] }> {
  return await eventsCall(
    { action: "edit", proposalId, ...details },
    currentMessages().api.editEvent,
  );
}

export async function cancelEvent(proposalId: string): Promise<{ events: SuggestedEvent[] }> {
  return await eventsCall({ action: "cancel", proposalId }, currentMessages().api.cancelEvent);
}

/** Drop out of an event someone else suggested; it carries on without you. */
export async function leaveEvent(proposalId: string): Promise<{ events: SuggestedEvent[] }> {
  return await eventsCall({ action: "leave", proposalId }, currentMessages().api.leaveEvent);
}

/**
 * Put a scheduled event into your primary calendar now. Waits for iCloud's
 * answer, so a failure (with its reason) comes back as an error; Casy then
 * keeps trying on its own every hour.
 */
export async function addToMyCalendar(proposalId: string): Promise<{ events: SuggestedEvent[] }> {
  return await eventsCall(
    { action: "add-to-calendar", proposalId },
    currentMessages().api.addToCalendar,
  );
}

/** A scheduled event as a calendar file, for adding by hand. */
export async function eventCalendarFile(
  proposalId: string,
): Promise<{ filename: string; ics: string }> {
  return await callFunction("events", {
    body: { action: "ics", proposalId },
    errorMessage: currentMessages().api.downloadEvent,
  });
}
