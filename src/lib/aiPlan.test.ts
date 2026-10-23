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
  planFeedback,
  planFieldsOf,
  type PlanSettings,
  statedFields,
  toPlanSettings,
} from "@/lib/aiPlan";
import { NO_PEOPLE_CHOICE, type SchedulerSettings } from "@/lib/scheduler";
import { wallTime } from "@/lib/zone";

const TZ = "Europe/Copenhagen";

const NOTHING: PlanSettings = {
  kind: null,
  startHour: null,
  anyTime: null,
  startWindow: null,
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

describe("start windows (#133)", () => {
  const dinner = { from: 18 * 60, to: 21 * 60 };

  it("set the window with its first hour, and any start said later replaces it", () => {
    const next = applyPlan(
      AI_BASE_SETTINGS,
      { ...NOTHING, kind: "meeting", startHour: 18, anyTime: false, startWindow: dinner },
      TZ,
    );
    expect(next).toMatchObject({ startWindow: dinner, startHour: 18, anyTime: false });
    expect(applyPlan(next, { ...NOTHING, startHour: 19, anyTime: false }, TZ)).toMatchObject({
      startWindow: null,
      startHour: 19,
    });
    expect(applyPlan(next, { ...NOTHING, anyTime: true }, TZ)).toMatchObject({
      startWindow: null,
      anyTime: true,
    });
    // Nothing said about the start keeps the window.
    expect(applyPlan(next, { ...NOTHING, durationMinutes: 180 }, TZ).startWindow).toEqual(dinner);
  });

  it("ignore a window that isn't one", () => {
    const bad = { ...NOTHING, startWindow: { from: 1260, to: 1080 } };
    expect(applyPlan(AI_BASE_SETTINGS, bad, TZ).startWindow).toBeNull();
  });

  it("go back to the AI with the settings so far", () => {
    const settings: SchedulerSettings = { ...AI_BASE_SETTINGS, startWindow: dinner };
    expect(toPlanSettings(settings, TZ)).toMatchObject({ startHour: 18, startWindow: dinner });
  });

  it("mark the start as said when stated, as guessed when assumed", () => {
    const window = plan({ kind: "meeting", startHour: 18, anyTime: false, startWindow: dinner });
    expect(guessedFields(window, true)).toEqual(["durationMinutes"]);
    const assumed = { ...window, assumed: ["startHour" as const, "startWindow" as const] };
    expect(guessedFields(assumed, true)).toEqual(["startHour", "startWindow", "durationMinutes"]);
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

describe("marks", () => {
  it("come off the settings a change touches", () => {
    // A start picked by hand replaces the AI's window too (#133).
    expect(planFieldsOf({ startHour: 19 })).toEqual(["startHour", "startWindow"]);
    expect(planFieldsOf({ anyTime: true, durationMinutes: 60 })).toEqual([
      "startHour",
      "startWindow",
      "durationMinutes",
    ]);
    expect(planFieldsOf({ startDow: null })).toEqual(["startWeekday", "kind"]);
    expect(planFieldsOf({ period: null, dows: [5] })).toEqual(["weekdays", "months"]);
  });

  it("know what a plan states rather than guesses", () => {
    expect(
      statedFields({ ...NOTHING, kind: "meeting", startHour: 18, durationMinutes: 180 }, [
        "durationMinutes",
      ]),
    ).toEqual(["kind", "startHour"]);
  });
});

describe("planFeedback (#122)", () => {
  const plan: AiPlan = {
    kind: "meeting",
    startHour: 18,
    anyTime: false,
    startWindow: null,
    durationMinutes: 180,
    weekdays: [5],
    days: null,
    startWeekday: null,
    months: { from: "2026-11", to: "2026-11" },
    title: "Middag",
    place: null,
    note: null,
    people: { without: ["Jonas"], optional: [], required: [] },
    atLeast: null,
    assumed: ["startHour"],
    questions: [{ question: "Hvornår på aftenen?", options: [] }],
  };
  const sent: SchedulerSettings = {
    ...AI_BASE_SETTINGS,
    startHour: 19,
    durationMinutes: 180,
    dows: [5],
    period: {
      from: new Date(wallTime(2026, 10, 1, 0, TZ)).toISOString(),
      to: new Date(wallTime(2026, 11, 1, 0, TZ)).toISOString(),
    },
  };

  it("has the descriptions, the AI's settings, what was changed by hand and where it ended", () => {
    const feedback = planFeedback(
      ["Middag en fredag i november uden Jonas"],
      plan,
      ["startHour"],
      sent,
      TZ,
    )!;
    expect(feedback.texts).toEqual(["Middag en fredag i november uden Jonas"]);
    expect(feedback.plan).toMatchObject({ kind: "meeting", startHour: 18, assumed: ["startHour"] });
    expect(feedback.overridden).toEqual(["startHour"]);
    expect(feedback.final).toMatchObject({ kind: "meeting", startHour: 19, weekdays: [5] });
  });

  it("leaves out the people the AI named and its questions", () => {
    const feedback = planFeedback(["x"], plan, [], sent, TZ)!;
    expect(feedback.plan).not.toHaveProperty("people");
    expect(feedback.plan).not.toHaveProperty("questions");
    expect(feedback.plan).not.toHaveProperty("atLeast");
    expect(JSON.stringify(feedback)).not.toContain("Jonas");
  });

  it("says nothing before a description or a plan", () => {
    expect(planFeedback([], plan, [], sent, TZ)).toBeNull();
    expect(planFeedback(["x"], null, [], sent, TZ)).toBeNull();
  });
});
