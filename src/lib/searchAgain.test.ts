import { describe, expect, it } from "vitest";

import { findEventSlot, type EventSettings } from "@/lib/eventSearch";
import { planFromVote, withAnswers } from "@/lib/searchAgain";
import { wallTime } from "@/lib/zone";
import type { Participant } from "@/types";

const TZ = "Europe/Copenhagen";
const at = (day: number, hour: number) => new Date(wallTime(2026, 9, day, hour, TZ)).toISOString();
const FROM = at(12, 0);
const END = new Date(wallTime(2026, 11, 1, 0, TZ)).toISOString();
const EVENING: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };
const person = (id: string): Participant => ({ profileId: id, name: id, busy: [] });
const evening = (day: number) => ({ start: at(day, 18), end: at(day, 21) });

describe("searching a vote again (#240)", () => {
  it("never finds again a date someone said they can't make", () => {
    const answered = [{ ...evening(12), answers: { a: "accepted", b: "declined" } }];
    const group = withAnswers([person("a"), person("b")], answered);
    expect(group[1].busy).toEqual([{ ...evening(12), priority: "never" }]);
    expect(findEventSlot(group, EVENING, FROM, END, TZ).slot?.start).not.toBe(evening(12).start);
  });

  it('counts a "rather not" as time that could be skipped, and a yes as nothing', () => {
    const answered = [{ ...evening(12), answers: { a: "maybe", b: "accepted" } }];
    const group = withAnswers([person("a"), person("b")], answered);
    expect(group[0].busy).toEqual([{ ...evening(12), priority: "skip" }]);
    expect(group[1].busy).toEqual([]);
  });

  it("opens Planlæg with the vote's own plan, for everyone it is for now", () => {
    const evening = {
      ...EVENING,
      allowedDays: [5, 6],
      people: { members: ["a", "b"], optional: ["b"] },
    };
    expect(planFromVote(evening, ["a", "b", "c"], ["a", "b", "c", "d"])).toEqual({
      sched: {
        multiDay: false,
        startHour: 18,
        durationMinutes: 180,
        anyTime: false,
        startWindow: null,
        dows: [5, 6],
        period: null,
      },
      people: { states: { a: "required", b: "optional", c: "required", d: "out" }, atLeast: null },
    });
    expect(planFromVote({ kind: "vacation", days: 4 }, ["a"], ["a"]).sched).toEqual({
      multiDay: true,
      startDow: null,
      days: 4,
      period: null,
    });
  });
});
