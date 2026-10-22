import { assertEquals } from "jsr:@std/assert@1";

import {
  type DateImpact,
  type DayFact,
  impactOn,
  matchScore,
  PENALTY,
  type PlannedProfile,
  readFacts,
  strongestClash,
} from "./dayScores.ts";

const ZONE = "Europe/Copenhagen";

interface Cases {
  impact: {
    name: string;
    profile: PlannedProfile | null;
    single: boolean;
    start: string;
    end: string;
    effects: string[];
  }[];
  clash: {
    name: string;
    planned: DateImpactJson;
    fact: Omit<DayFact, "start"> & { start: string };
    expected: "critical" | "warning" | null;
  }[];
}
type DateImpactJson = Omit<DateImpact, "start" | "end"> & {
  start: string;
  end: string;
};

const cases = JSON.parse(
  await Deno.readTextFile(new URL("../../testdata/dayScoreCases.json", import.meta.url)),
) as Cases;

for (const c of cases.impact) {
  Deno.test(`impactOn: ${c.name}`, () => {
    const impact = impactOn(
      c.profile,
      { start: Date.parse(c.start), end: Date.parse(c.end) },
      c.single,
      ZONE,
    );
    assertEquals(impact.effects, c.effects);
  });
}

for (const c of cases.clash) {
  Deno.test(`strongestClash: ${c.name}`, () => {
    const impact: DateImpact = {
      ...c.planned,
      start: Date.parse(c.planned.start),
      end: Date.parse(c.planned.end),
    };
    const fact: DayFact = { ...c.fact, start: Date.parse(c.fact.start) };
    assertEquals(strongestClash(impact, [fact], ZONE), c.expected);
  });
}

const date: DateImpact = {
  effects: ["lateNight", "alcohol"],
  strain: "moderate",
  recoveryDays: 0,
  start: Date.parse("2026-10-09T18:00:00+02:00"),
  end: Date.parse("2026-10-10T02:00:00+02:00"),
};
const exam = (level: "high" | "critical"): DayFact => ({
  start: Date.parse("2026-10-10T09:00:00+02:00"),
  level,
  avoid: ["alcohol"],
  prepDays: 0,
});

Deno.test("the score is what is left of the group after each member's strongest clash", () => {
  // Nobody has shared anything: nothing to lose.
  assertEquals(matchScore(date, [[], [], []], ZONE), 100);
  // One of five has a critical clash: a fifth is gone.
  assertEquals(matchScore(date, [[exam("critical")], [], [], [], []], ZONE), 80);
  // A critical and a warning among four.
  assertEquals(matchScore(date, [[exam("critical")], [exam("high")], [], []], ZONE), 65);
  // A group of one with a critical clash is as bad as it gets.
  assertEquals(matchScore(date, [[exam("critical")]], ZONE), 0);
  // Several clashes cost a member no more than their strongest.
  assertEquals(matchScore(date, [[exam("critical"), exam("critical")], []], ZONE), 50);
  assertEquals(PENALTY.critical, 1);
});

Deno.test("an empty group is not marked down", () => {
  assertEquals(matchScore(date, [], ZONE), 100);
});

Deno.test("facts from a request are snapped into what they may be", () => {
  const now = Date.parse("2026-10-07T08:00:00Z");
  const inTwoDays = now + 2 * 86_400_000;
  const facts = readFacts(
    [
      {
        start: inTwoDays + 0.4,
        level: "critical",
        avoid: ["alcohol", "nonsense", "alcohol"],
        prepDays: 99,
      },
      { start: inTwoDays, level: "high", avoid: "x", prepDays: -3 },
      // Far past and far future could never matter: dropped.
      { start: now - 30 * 86_400_000, level: "high", avoid: [], prepDays: 0 },
      { start: now + 900 * 86_400_000, level: "high", avoid: [], prepDays: 0 },
    ],
    now,
  );
  assertEquals(facts, [
    { start: inTwoDays, level: "critical", avoid: ["alcohol"], prepDays: 14 },
    { start: inTwoDays, level: "high", avoid: [], prepDays: 0 },
  ]);
});

Deno.test("anything that is not a list of facts is refused", () => {
  assertEquals(readFacts("x"), null);
  assertEquals(readFacts([null]), null);
  assertEquals(readFacts([{ start: "soon", level: "high" }]), null);
  assertEquals(readFacts([{ start: Date.now() + 1000, level: "low" }]), null);
  assertEquals(readFacts(new Array(401).fill({ start: Date.now(), level: "high" })), null);
});
