import { describe, expect, it } from "vitest";

import type { CandidateDate, EventResponse } from "@/api/events";
import {
  bestPick,
  firstUnanswered,
  leader,
  stillToAnswer,
  tally,
  voteStage,
  type VoteEvent,
} from "@/lib/vote";

const NOW = Date.parse("2026-10-07T12:00:00.000Z");

function date(id: string, day: number, answers: Record<string, EventResponse> = {}): CandidateDate {
  return {
    id,
    start: `2026-10-${day}T16:00:00.000Z`,
    end: `2026-10-${day}T19:00:00.000Z`,
    answers,
  };
}

function vote(candidates: CandidateDate[], overrides: Partial<VoteEvent> = {}): VoteEvent {
  return {
    id: "v",
    group: { id: "g", name: "Assebasser" },
    title: "Julefrokost",
    place: null,
    note: null,
    settings: { kind: "single", durationMinutes: 180, startHour: 18 },
    status: "pending",
    mode: "vote",
    answerBy: "2026-10-10T12:00:00.000Z",
    createdBy: { id: "me", name: "Asbjørn", isYou: true },
    createdAt: "2026-10-07T10:00:00.000Z",
    updatedAt: "2026-10-07T10:00:00.000Z",
    currentDate: null,
    candidates,
    invitees: [
      { profileId: "me", name: "Asbjørn", isYou: true, response: null },
      { profileId: "tessa", name: "Tessa", isYou: false, response: null },
    ],
    declinedDates: [],
    ...overrides,
  };
}

describe("tally", () => {
  it("counts answers of people still invited, and who hasn't answered", () => {
    const event = vote([]);
    const d = date("a", 12, { me: "maybe", gone: "declined" });
    expect(tally(d, event)).toEqual({ accepted: 0, maybe: 1, declined: 0, missing: 1 });
  });
});

describe("leader", () => {
  it("picks the date nobody declined with the fewest maybes, earliest first", () => {
    const event = vote([
      date("early", 12, { me: "accepted", tessa: "declined" }),
      date("meh", 13, { me: "maybe", tessa: "accepted" }),
      date("clean", 14, { me: "accepted", tessa: "accepted" }),
      date("clean-later", 15, { me: "accepted", tessa: "accepted" }),
    ]);
    expect(leader(event, NOW)?.id).toBe("clean");
  });

  it("is null when every date has a decline, and bestPick finds the least bad", () => {
    const event = vote([
      date("a", 12, { me: "declined", tessa: "declined" }),
      date("b", 13, { me: "accepted", tessa: "declined" }),
    ]);
    expect(leader(event, NOW)).toBeNull();
    expect(bestPick(event, NOW)?.id).toBe("b");
  });

  it("ignores dates already begun", () => {
    const event = vote([date("past", 6, { me: "accepted", tessa: "accepted" }), date("b", 13)]);
    expect(leader(event, NOW)?.id).toBe("b");
  });
});

describe("voteStage", () => {
  it("asks you to answer while a date to come lacks your answer, from the first such", () => {
    const event = vote([date("a", 12, { me: "accepted" }), date("b", 13)]);
    expect(voteStage(event, NOW)).toBe("answer");
    expect(firstUnanswered(event, NOW)).toBe(1);
  });

  it("waits on others once you've answered everything", () => {
    const event = vote([date("a", 12, { me: "accepted" })]);
    expect(voteStage(event, NOW)).toBe("waiting");
    expect(stillToAnswer(event, NOW)).toEqual(["Tessa"]);
    expect(firstUnanswered(event, NOW)).toBe(-1);
  });

  it("hands the suggester the choice once every date has a decline", () => {
    const answers = { me: "accepted", tessa: "declined" } as const;
    const event = vote([date("a", 12, answers)]);
    expect(voteStage(event, NOW)).toBe("choose");
    expect(
      voteStage({ ...event, createdBy: { id: "tessa", name: "Tessa", isYou: false } }, NOW),
    ).toBe("waitingForChoice");
  });

  it("decides at the deadline without the missing answers", () => {
    const event = vote([date("a", 12, { me: "declined" })], {
      answerBy: "2026-10-07T00:00:00.000Z",
    });
    expect(voteStage(event, NOW)).toBe("choose");
  });
});
