import { describe, expect, it } from "vitest";

import {
  AI_BASE_SETTINGS,
  type AiPlan,
  applyPeople,
  applyPlan,
  guessedFields,
  isoToMonth,
  matchNames,
  mentionedNames,
  monthToIso,
  type PlanSettings,
  toPlanSettings,
} from "@/lib/aiPlan";
import { NO_PEOPLE_CHOICE } from "@/lib/scheduler";

const TZ = "Europe/Copenhagen";

const NOTHING: PlanSettings = {
  kind: null,
  startHour: null,
  anyTime: null,
  durationMinutes: null,
  weekdays: null,
  days: null,
  startWeekday: null,
  months: null,
};

function plan(fields: Partial<AiPlan> = {}): AiPlan {
  return {
    ...NOTHING,
    title: null,
    place: null,
    note: null,
    people: { without: [], optional: [], required: [] },
    atLeast: null,
    assumed: [],
    questions: [],
    ...fields,
  };
}

describe("months", () => {
  it("are the local midnight of the 1st, winter and summer time alike", () => {
    expect(monthToIso("2026-12", TZ)).toBe("2026-11-30T23:00:00.000Z");
    expect(monthToIso("2027-07", TZ)).toBe("2027-06-30T22:00:00.000Z");
    expect(monthToIso("December", TZ)).toBeNull();
    expect(monthToIso("2026-13", TZ)).toBeNull();
  });

  it("read back as the month they start", () => {
    expect(isoToMonth("2026-11-30T23:00:00.000Z", TZ)).toBe("2026-12");
    expect(isoToMonth("2027-06-30T22:00:00.000Z", TZ)).toBe("2027-07");
  });
});

describe("applyPlan", () => {
  it("leaves everything the plan says nothing about", () => {
    expect(applyPlan(AI_BASE_SETTINGS, NOTHING, TZ)).toEqual(AI_BASE_SETTINGS);
  });

  it("makes a meeting at a time, on some weekdays, in some months", () => {
    const next = applyPlan(
      AI_BASE_SETTINGS,
      {
        ...NOTHING,
        kind: "meeting",
        startHour: 19,
        anyTime: false,
        durationMinutes: 150,
        weekdays: [0, 5, 6],
        months: { from: "2026-12", to: "2027-01" },
      },
      TZ,
    );
    expect(next).toEqual({
      ...AI_BASE_SETTINGS,
      startHour: 19,
      durationMinutes: 150,
      // Monday first, as the controls show them.
      dows: [5, 6, 0],
      period: { from: "2026-11-30T23:00:00.000Z", to: "2026-12-31T23:00:00.000Z" },
    });
  });

  it("makes a meeting at any time of day", () => {
    const next = applyPlan(AI_BASE_SETTINGS, { ...NOTHING, kind: "meeting", anyTime: true }, TZ);
    expect(next.anyTime).toBe(true);
    // A time given later switches "any time" off again.
    expect(applyPlan(next, { ...NOTHING, startHour: 14 }, TZ)).toMatchObject({
      anyTime: false,
      startHour: 14,
    });
  });

  it("makes a trip from a weekday, at most a week long", () => {
    expect(
      applyPlan(AI_BASE_SETTINGS, { ...NOTHING, kind: "trip", days: 12, startWeekday: 4 }, TZ),
    ).toMatchObject({ multiDay: true, startDow: 4, days: 7 });
  });

  it("makes a holiday that may start any day, up to 30 days", () => {
    expect(
      applyPlan(AI_BASE_SETTINGS, { ...NOTHING, kind: "holiday", days: 14 }, TZ),
    ).toMatchObject({ multiDay: true, startDow: null, days: 14 });
  });

  it("turns a holiday into a trip when a start weekday is given", () => {
    const holiday = { ...AI_BASE_SETTINGS, multiDay: true, startDow: null, days: 10 };
    expect(applyPlan(holiday, { ...NOTHING, startWeekday: 5 }, TZ)).toMatchObject({
      startDow: 5,
      days: 7,
    });
  });

  it("ignores a start weekday for a meeting", () => {
    expect(applyPlan(AI_BASE_SETTINGS, { ...NOTHING, startWeekday: 5 }, TZ)).toEqual(
      AI_BASE_SETTINGS,
    );
  });

  it("clears the period for any time of year, and orders a reversed one", () => {
    const withPeriod = applyPlan(
      AI_BASE_SETTINGS,
      { ...NOTHING, months: { from: "2027-02", to: "2026-12" } },
      TZ,
    );
    expect(withPeriod.period).toEqual({
      from: "2026-11-30T23:00:00.000Z",
      to: "2027-01-31T23:00:00.000Z",
    });
    expect(applyPlan(withPeriod, { ...NOTHING, months: "any" }, TZ).period).toBeNull();
  });

  it("refuses values outside the controls", () => {
    expect(
      applyPlan(
        AI_BASE_SETTINGS,
        { ...NOTHING, startHour: 25, durationMinutes: 45, weekdays: [9], days: 0 },
        TZ,
      ),
    ).toEqual(AI_BASE_SETTINGS);
  });
});

describe("toPlanSettings", () => {
  it("reads a meeting back, every weekday as none named", () => {
    expect(toPlanSettings(AI_BASE_SETTINGS, TZ)).toEqual({
      ...NOTHING,
      kind: "meeting",
      startHour: 18,
      anyTime: false,
      durationMinutes: 120,
    });
  });

  it("round-trips through applyPlan", () => {
    const settings = {
      ...AI_BASE_SETTINGS,
      multiDay: true,
      startDow: 5,
      days: 3,
      period: { from: "2026-11-30T23:00:00.000Z", to: "2026-11-30T23:00:00.000Z" },
    };
    const back = toPlanSettings(settings, TZ);
    expect(back).toMatchObject({
      kind: "trip",
      days: 3,
      startWeekday: 5,
      months: { from: "2026-12", to: "2026-12" },
    });
    expect(applyPlan(AI_BASE_SETTINGS, back, TZ)).toEqual(settings);
  });
});

describe("guessedFields", () => {
  it("adds what a first meeting needs and the AI left out", () => {
    expect(guessedFields(plan({ kind: "meeting", durationMinutes: 60 }), true)).toEqual([
      "startHour",
    ]);
    expect(guessedFields(plan({ kind: "meeting", anyTime: true }), true)).toEqual([
      "durationMinutes",
    ]);
    expect(guessedFields(plan({ kind: "trip", assumed: ["days"], days: 2 }), true)).toEqual([
      "days",
      "startWeekday",
    ]);
  });

  it("keeps only the AI's own when details are added", () => {
    expect(guessedFields(plan({ startHour: 14, assumed: ["startHour"] }), false)).toEqual([
      "startHour",
    ]);
    expect(guessedFields(plan({ months: { from: "2026-12", to: "2026-12" } }), false)).toEqual([]);
  });
});

describe("names", () => {
  const members = [
    { profileId: "me", name: "Asbjørn", isYou: true },
    { profileId: "p1", name: "Peter Hansen", isYou: false },
    { profileId: "p2", name: "Peter Holm", isYou: false },
    { profileId: "a", name: "Anna", isYou: false },
    { profileId: "s", name: "Søren", isYou: false },
  ];

  it("match a whole name, then a first name, never a part of one", () => {
    expect(matchNames(["peter hansen", "Peter", "anna", "Ann", "Soren"], members)).toEqual([
      { written: "peter hansen", candidates: ["p1"] },
      { written: "Peter", candidates: ["p1", "p2"] },
      { written: "anna", candidates: ["a"] },
      { written: "Ann", candidates: [] },
      { written: "Soren", candidates: ["s"] },
    ]);
  });

  it("never match you", () => {
    expect(matchNames(["Asbjørn"], members)).toEqual([{ written: "Asbjørn", candidates: [] }]);
  });

  it("set each matched person, and the quorum, on the choice", () => {
    const p = plan({
      people: { without: ["Peter"], optional: ["Anna"], required: ["Ghost"] },
      atLeast: 3,
    });
    expect(mentionedNames(p)).toEqual(["Peter", "Anna", "Ghost"]);
    expect(applyPeople(NO_PEOPLE_CHOICE, p, { Peter: "p1", Anna: "a" })).toEqual({
      states: { p1: "out", a: "optional" },
      atLeast: 3,
    });
    expect(applyPeople({ states: { a: "out" }, atLeast: 2 }, plan(), {})).toEqual({
      states: { a: "out" },
      atLeast: 2,
    });
  });
});
