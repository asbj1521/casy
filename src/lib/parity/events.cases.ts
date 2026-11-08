/** vote.ts and myEvents.ts, for Events.swift. */
import { type EventResponse, needsYourAnswer, type SuggestedEvent } from "@/api/events";
import { phoneEventGroups, sectionEvents, type StagedEvent } from "@/lib/myEvents";
import {
  allAnswered,
  bestPick,
  firstUnanswered,
  leader,
  stillToAnswer,
  tally,
  upcomingDates,
  type VoteEvent,
  voteStage,
} from "@/lib/vote";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ids = (events: { id: string }[]) => events.map((e) => e.id);
const staged = (list: StagedEvent[]) => list.map((s) => ({ stage: s.stage, id: s.event.id }));

export function eventsCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261113);
  const flag = (odds: number) => random() < odds;
  let next = 0;

  const event = (): SuggestedEvent => {
    const id = `e${next++}`;
    const size = int(1, 6);
    const you = int(0, size);
    const invitees = Array.from({ length: size }, (_, n) => ({
      profileId: `p${n}`,
      name: `Person ${n}`,
      isYou: n === you,
      response: null,
    }));
    const optional = invitees.filter(() => flag(0.2)).map((p) => p.profileId);
    const people = flag(0.5)
      ? {
          members: invitees.map((p) => p.profileId),
          optional,
          ...(flag(0.5) ? { atLeast: int(1, size) } : {}),
        }
      : undefined;
    const mode = pick(["vote", "vote", "vote", "single"] as const);
    const count = mode === "vote" ? int(0, 5) : 0;
    const candidates = Array.from({ length: count }, (_, n) => {
      const start = NOW + int(-48, 500) * HOUR;
      const answers: Record<string, EventResponse> = {};
      for (const p of invitees) {
        if (flag(0.7)) answers[p.profileId] = pick(["accepted", "accepted", "maybe", "declined"]);
      }
      return { id: `${id}d${n}`, start: iso(start), end: iso(start + 2 * HOUR), answers };
    }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const dated = flag(0.5);
    const startsAt = NOW + int(-300, 300) * HOUR;
    return {
      id,
      group: { id: "g", name: "Group" },
      title: "Event",
      place: null,
      note: null,
      settings: { kind: "vacation", days: 1, ...(people ? { people } : {}) },
      status: pick(["pending", "pending", "scheduled", "no_date", "cancelled"]),
      mode,
      answerBy: flag(0.3) ? iso(NOW + int(-48, 48) * HOUR) : null,
      createdBy: { id: "p0", name: "Person 0", isYou: flag(0.5) },
      createdAt: iso(NOW - 900 * HOUR),
      updatedAt: iso(NOW - int(0, 400) * HOUR),
      currentDate: dated
        ? { id: `${id}c`, start: iso(startsAt), end: iso(startsAt + 2 * HOUR) }
        : null,
      candidates,
      invitees,
      declinedDates: [],
    };
  };

  for (let i = 0; i < 250; i++) {
    const e = event();
    const now = NOW;
    if (e.mode !== "vote") {
      add("needsYourAnswer", { event: e, now }, needsYourAnswer(e, now));
      continue;
    }
    const vote = e as VoteEvent;
    add(
      "vote",
      { event: e, now },
      {
        upcoming: ids(upcomingDates(vote, now)),
        firstUnanswered: firstUnanswered(vote, now),
        allAnswered: allAnswered(vote, now),
        leader: leader(vote, now)?.id ?? null,
        bestPick: bestPick(vote, now)?.id ?? null,
        stage: voteStage(vote, now),
        stillToAnswer: stillToAnswer(vote, now),
        needsYourAnswer: needsYourAnswer(e, now),
        tallies: e.candidates.map((c) => ({
          all: tally(c, e),
          required: tally(c, e, { required: true }),
        })),
      },
    );
  }

  for (let i = 0; i < 40; i++) {
    const events = Array.from({ length: int(0, 14) }, event);
    const now = NOW;
    const sections = sectionEvents(events, now);
    const groups = phoneEventGroups(events, now);
    add(
      "lists",
      { events, now },
      {
        toSwipe: ids(sections.toSwipe),
        voting: ids(sections.voting),
        scheduled: ids(sections.scheduled),
        closed: ids(sections.closed),
        answer: staged(groups.answer),
        coming: staged(groups.coming),
        past: staged(groups.past),
      },
    );
  }
  return cases;
}
