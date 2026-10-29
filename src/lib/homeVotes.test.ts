import { describe, expect, it } from "vitest";

import type { CandidateDate, SuggestedEvent } from "@/api/events";
import {
  CASY_CALENDAR,
  newlyDecided,
  pencilItems,
  scheduledItems,
  waitingVotes,
} from "@/lib/homeVotes";
import type { VoteEvent } from "@/lib/vote";

const NOW = Date.parse("2026-09-22T12:00:00.000Z");

function date(id: string, day: number, answers: CandidateDate["answers"] = {}): CandidateDate {
  const start = `2026-09-${day}T16:00:00.000Z`;
  return { id, start, end: `2026-09-${day}T19:00:00.000Z`, answers };
}

function event(overrides: Partial<SuggestedEvent> & { id: string }): SuggestedEvent {
  return {
    group: { id: "g1", name: "Assebasser" },
    title: "Middag",
    place: null,
    note: null,
    settings: { kind: "single", durationMinutes: 180, startHour: 18 },
    status: "pending",
    mode: "vote",
    answerBy: null,
    candidates: [],
    createdBy: { id: "emilie", name: "Emilie", isYou: false },
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    currentDate: null,
    invitees: [
      { profileId: "me", name: "Asbjørn", isYou: true, response: null },
      { profileId: "emilie", name: "Emilie", isYou: false, response: null },
    ],
    declinedDates: [],
    ...overrides,
  };
}

const vote = event({ id: "v", candidates: [date("a", 24), date("b", 26)] });
const answered = event({
  id: "done",
  candidates: [date("a", 24, { me: "accepted" }), date("b", 26, { me: "declined" })],
});
const decided = event({
  id: "s",
  status: "scheduled",
  candidates: [date("c", 28, { me: "accepted" })],
  currentDate: { id: "c", start: date("c", 28).start, end: date("c", 28).end },
});

describe("the home page's votes (#172)", () => {
  it("waits only for the votes you still have dates to answer in", () => {
    expect(waitingVotes([vote, answered, decided], NOW).map((e) => e.id)).toEqual(["v"]);
  });

  it("pencils in each waiting date under the vote's title", () => {
    const items = pencilItems([vote as VoteEvent], (e) => e.title, NOW);
    expect(items).toEqual([
      expect.objectContaining({ calendarId: CASY_CALENDAR, label: "Middag", pencil: true }),
      expect.objectContaining({ start: Date.parse("2026-09-26T16:00:00.000Z") }),
    ]);
  });

  it("draws a decided event, unless your calendar holds it already or you said no", () => {
    const title = (e: SuggestedEvent) => e.title;
    const start = Date.parse("2026-09-28T16:00:00.000Z");
    const end = Date.parse("2026-09-28T19:00:00.000Z");
    expect(scheduledItems([decided], [], title, NOW)).toEqual([
      { calendarId: CASY_CALENDAR, start, end, label: "Middag" },
    ]);
    const written = { calendarId: "google", start, end, label: "Privat" };
    expect(scheduledItems([decided], [written], title, NOW)).toEqual([]);
    const notGoing = event({
      ...decided,
      candidates: [date("c", 28, { me: "declined" })],
    });
    expect(scheduledItems([notGoing], [], title, NOW)).toEqual([]);
  });

  it("flies in only what was decided since this device last looked", () => {
    expect(newlyDecided([vote, decided], new Set(), NOW).map((e) => e.id)).toEqual(["s"]);
    expect(newlyDecided([vote, decided], new Set(["s"]), NOW)).toEqual([]);
  });
});
