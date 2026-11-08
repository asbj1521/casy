import { describe, expect, it } from "vitest";

import type { EventSettings } from "@/lib/eventSearch";
import { searchAgainDates, searchSettings, withAnswers } from "@/lib/searchAgain";
import { wallTime } from "@/lib/zone";
import type { Participant } from "@/types";

const TZ = "Europe/Copenhagen";
const at = (day: number, hour: number) => new Date(wallTime(2026, 9, day, hour, TZ)).toISOString();
const FROM = at(12, 0);
const END = new Date(wallTime(2026, 11, 1, 0, TZ)).toISOString();
const NOW = wallTime(2026, 9, 1, 12, TZ);
const EVENING: EventSettings = { kind: "single", durationMinutes: 180, startHour: 18 };
const person = (id: string): Participant => ({ profileId: id, name: id, busy: [] });
const evening = (day: number) => ({ start: at(day, 18), end: at(day, 21) });

describe("searching a vote again (#240)", () => {
  it("never offers again a date someone said they can't make", () => {
    const answered = [{ ...evening(12), answers: { a: "accepted", b: "declined" } }];
    const group = withAnswers([person("a"), person("b")], answered);
    const dates = searchAgainDates(
      group,
      EVENING,
      { from: FROM, end: END, count: 3, now: NOW },
      TZ,
    );
    expect(dates).toHaveLength(3);
    expect(dates!.map((d) => d.start)).not.toContain(evening(12).start);
  });

  it("puts a date nobody minds before one someone would rather not", () => {
    const answered = [{ ...evening(12), answers: { a: "maybe" } }];
    const group = withAnswers([person("a"), person("b")], answered);
    expect(group[0].busy).toEqual([{ ...evening(12), priority: "skip" }]);
    expect(group[1].busy).toEqual([]);
    const dates = searchAgainDates(
      group,
      EVENING,
      { from: FROM, end: END, count: 2, now: NOW },
      TZ,
    );
    expect(dates!.map((d) => d.start)).not.toContain(evening(12).start);
  });

  it("finds nothing when no date suits everyone", () => {
    const always = {
      ...person("b"),
      busy: [{ start: FROM, end: END, priority: "never" as const }],
    };
    expect(
      searchAgainDates([person("a"), always], EVENING, { from: FROM, end: END, count: 3 }, TZ),
    ).toBeNull();
  });

  it("offers as many dates as the vote had, 2 to 5", () => {
    const group = [person("a")];
    const count = (n: number) =>
      searchAgainDates(group, EVENING, { from: FROM, end: END, count: n, now: NOW }, TZ)!.length;
    expect(count(1)).toBe(2);
    expect(count(4)).toBe(4);
    expect(count(9)).toBe(5);
  });

  it("is for everyone invited now: the whole group names nobody, as the server keeps it", () => {
    const left = { ...EVENING, people: { members: ["a", "b"], optional: ["b"] } };
    expect(searchSettings(left, ["a", "b", "c"], ["a", "b", "c"])).toEqual({
      ...EVENING,
      people: { members: ["a", "b", "c"], optional: ["b"] },
    });
    expect(
      searchSettings(
        { ...EVENING, people: { members: ["a"], optional: [] } },
        ["a", "b"],
        ["a", "b"],
      ),
    ).toEqual(EVENING);
    expect(searchSettings(EVENING, ["a"], ["a", "b"])).toEqual({
      ...EVENING,
      people: { members: ["a"], optional: [] },
    });
  });
});
