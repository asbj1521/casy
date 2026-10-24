import { describe, expect, it } from "vitest";

import type { SuggestedEvent } from "@/api/events";
import { eventsInOrder, phoneEventList, sectionEvents } from "@/lib/myEvents";

const NOW = Date.parse("2026-09-22T12:00:00.000Z");

function event(overrides: Partial<SuggestedEvent> & { id: string }): SuggestedEvent {
  return {
    group: { id: "g1", name: "Assebasser" },
    title: "Evening",
    place: null,
    note: null,
    settings: { kind: "single", durationMinutes: 180, startHour: 18 },
    status: "pending",
    mode: "single",
    answerBy: null,
    candidates: [],
    createdBy: { id: "emilie", name: "Emilie", isYou: false },
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    currentDate: { id: "d1", start: "2026-09-25T16:00:00.000Z", end: "2026-09-25T19:00:00.000Z" },
    invitees: [
      { profileId: "me", name: "Asbjørn", isYou: true, response: null },
      { profileId: "emilie", name: "Emilie", isYou: false, response: "accepted" },
    ],
    declinedDates: [],
    ...overrides,
  };
}

describe("sectionEvents", () => {
  it("calls a pending one-date event from before votes closed: it can't be answered any more (#159)", () => {
    const s = sectionEvents([event({ id: "old" })], NOW);
    expect(s.closed.map((e) => e.id)).toEqual(["old"]);
    expect(s.toSwipe).toEqual([]);
    expect(s.voting).toEqual([]);
  });

  it("files scheduled events by date, and moves past or closed ones aside", () => {
    const soon = event({
      id: "soon",
      status: "scheduled",
      currentDate: { id: "d2", start: "2026-09-24T16:00:00.000Z", end: "2026-09-24T19:00:00.000Z" },
    });
    const later = event({ id: "later", status: "scheduled" });
    const past = event({
      id: "past",
      status: "scheduled",
      currentDate: { id: "d3", start: "2026-09-20T16:00:00.000Z", end: "2026-09-20T19:00:00.000Z" },
    });
    const cancelled = event({ id: "cancelled", status: "cancelled" });
    const noDate = event({ id: "nodate", status: "no_date", currentDate: null });

    const s = sectionEvents([later, past, cancelled, soon, noDate], NOW);
    expect(s.scheduled.map((e) => e.id)).toEqual(["soon", "later"]);
    expect(s.closed.map((e) => e.id).sort()).toEqual(["nodate", "past"]);
  });

  it("drops a cancelled event entirely rather than filing it under closed", () => {
    const s = sectionEvents([event({ id: "gone", status: "cancelled" })], NOW);
    expect(s.toSwipe).toEqual([]);
    expect(s.voting).toEqual([]);
    expect(s.scheduled).toEqual([]);
    expect(s.closed).toEqual([]);
  });

  it("treats a pending event whose date has passed as closed", () => {
    const stale = event({
      id: "stale",
      currentDate: { id: "d4", start: "2026-09-21T16:00:00.000Z", end: "2026-09-21T19:00:00.000Z" },
    });
    expect(sectionEvents([stale], NOW).closed.map((e) => e.id)).toEqual(["stale"]);
  });
});

describe("sectionEvents with votes", () => {
  const date = (
    id: string,
    day: number,
    answers: Record<string, "accepted" | "declined"> = {},
  ) => ({
    id,
    start: `2026-09-${day}T16:00:00.000Z`,
    end: `2026-09-${day}T19:00:00.000Z`,
    answers,
  });
  const vote = (id: string, candidates: ReturnType<typeof date>[]) =>
    event({ id, mode: "vote", currentDate: null, candidates });

  it("asks you to swipe while a date to come is unanswered, soonest vote first", () => {
    const later = vote("later", [date("x", 28)]);
    const sooner = vote("sooner", [date("y", 21), date("z", 26)]);
    const s = sectionEvents([later, sooner], NOW);
    // 21 September has passed: "sooner" sorts by its 26th.
    expect(s.toSwipe.map((e) => e.id)).toEqual(["sooner", "later"]);
  });

  it("waits once you've answered every date to come", () => {
    const answered = vote("v", [
      date("x", 25, { me: "accepted" }),
      date("y", 27, { me: "declined" }),
    ]);
    const s = sectionEvents([answered], NOW);
    expect(s.voting.map((e) => e.id)).toEqual(["v"]);
    expect(s.toSwipe).toEqual([]);
  });

  it("closes a vote whose dates have all begun", () => {
    const s = sectionEvents([vote("old", [date("x", 20)])], NOW);
    expect(s.closed.map((e) => e.id)).toEqual(["old"]);
  });

  it("files a decided vote with the scheduled events", () => {
    const decided = { ...vote("done", [date("d1", 25)]), status: "scheduled" as const };
    decided.currentDate = {
      id: "d1",
      start: "2026-09-25T16:00:00.000Z",
      end: "2026-09-25T19:00:00.000Z",
    };
    expect(sectionEvents([decided], NOW).scheduled.map((e) => e.id)).toEqual(["done"]);
  });
});

/** A vote with one date to come (the 25th), answered or not by you. */
function openVote(id: string, createdAt: string, answered: boolean) {
  return event({
    id,
    mode: "vote",
    currentDate: null,
    createdAt,
    candidates: [
      {
        id: `${id}-d`,
        start: "2026-09-25T16:00:00.000Z",
        end: "2026-09-25T19:00:00.000Z",
        answers: answered ? { me: "accepted" } : {},
      },
    ],
  });
}

describe("eventsInOrder", () => {
  it("lists the sections in the page's order, each event with its section", () => {
    const s = sectionEvents(
      [
        event({ id: "closed", currentDate: null, status: "no_date" }),
        event({ id: "scheduled", status: "scheduled" }),
        openVote("waiting", "2026-09-20T10:00:00.000Z", true),
        openVote("answer", "2026-09-20T10:00:00.000Z", false),
      ],
      NOW,
    );
    expect(eventsInOrder(s).map(({ stage, event }) => [stage, event.id])).toEqual([
      ["toSwipe", "answer"],
      ["voting", "waiting"],
      ["scheduled", "scheduled"],
      ["closed", "closed"],
    ]);
  });

  it("is empty when there is nothing to show", () => {
    expect(eventsInOrder(sectionEvents([], NOW))).toEqual([]);
  });
});

describe("phoneEventList", () => {
  const day = 24 * 60 * 60 * 1000;
  const at = (ms: number) => new Date(ms).toISOString();

  it("lists what is to come newest first, whatever its stage", () => {
    const old = openVote("old", "2026-09-10T10:00:00.000Z", true);
    const agreed = event({
      id: "agreed",
      status: "scheduled",
      createdAt: "2026-09-15T10:00:00.000Z",
    });
    const fresh = openVote("fresh", "2026-09-21T10:00:00.000Z", false);
    const { live } = phoneEventList([old, agreed, fresh], NOW);
    expect(live.map((s) => s.event.id)).toEqual(["fresh", "agreed", "old"]);
    expect(live.map((s) => s.stage)).toEqual(["toSwipe", "scheduled", "voting"]);
  });

  it("keeps a past event at the bottom for a week after it ended, then drops it", () => {
    const ended = (id: string, daysAgo: number) =>
      event({
        id,
        status: "scheduled",
        currentDate: {
          id: `d-${id}`,
          start: at(NOW - daysAgo * day - 3_600_000),
          end: at(NOW - daysAgo * day),
        },
      });
    const { live, past } = phoneEventList(
      [ended("week", 8), ended("two", 2), ended("one", 1)],
      NOW,
    );
    expect(live).toEqual([]);
    expect(past.map((s) => s.event.id)).toEqual(["one", "two"]);
  });

  it("counts an event with no date left from when that was settled", () => {
    const noDate = (id: string, daysAgo: number) =>
      event({ id, status: "no_date", currentDate: null, updatedAt: at(NOW - daysAgo * day) });
    const { past } = phoneEventList([noDate("recent", 3), noDate("old", 10)], NOW);
    expect(past.map((s) => s.event.id)).toEqual(["recent"]);
  });
});
