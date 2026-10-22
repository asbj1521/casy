import { describe, expect, it } from "vitest";

import type { EventImpact } from "@/api/eventProfile";
import type { EventLabel } from "@/api/eventLabels";
import { dayFactsOf, MAX_FACTS } from "@/lib/dayFacts";
import { impactOn, type DateImpact } from "@/lib/eventImpact";
import type { EventSettings } from "@/lib/eventSearch";
import { importantClashes, type LabelledEvent } from "@/lib/eventWarnings";
import type { Effect, Strain } from "@/lib/eventVocabulary";
import { APP_TIME_ZONE } from "@/lib/zone";

// The cases the server's port runs too (supabase/functions/_shared/dayScores_test.ts):
// the app's warnings and the server's ranking must say the same.
import casesJson from "../../supabase/testdata/dayScoreCases.json?raw";

interface Cases {
  impact: {
    name: string;
    profile: { effects: Effect[]; runsLate: boolean; strain: Strain; recoveryDays: number } | null;
    single: boolean;
    start: string;
    end: string;
    effects: Effect[];
  }[];
  clash: {
    name: string;
    planned: {
      effects: Effect[];
      strain: Strain;
      recoveryDays: number;
      start: string;
      end: string;
    };
    fact: { start: string; level: "high" | "critical"; avoid: Effect[]; prepDays: number };
    expected: "critical" | "warning" | null;
  }[];
}
const cases = JSON.parse(casesJson) as Cases;

const labelled = (
  start: number,
  importance: EventLabel["importance"],
  avoidBefore: Effect[] = [],
  prepDays = 0,
): LabelledEvent => ({
  title: "Something",
  start,
  end: start + 3_600_000,
  allDay: false,
  label: {
    kind: "exam",
    importance,
    prepDays,
    avoidBefore,
    recoveryDays: 0,
    strain: "light",
    confidence: "high",
    reason: "",
  },
});

describe("impactOn, against the cases the server runs too", () => {
  for (const c of cases.impact) {
    it(c.name, () => {
      const profile = c.profile
        ? ({ ...c.profile, outdoors: false, daylight: false } as unknown as EventImpact)
        : null;
      const settings = { kind: c.single ? "single" : "trip" } as unknown as EventSettings;
      const impact = impactOn(profile, { start: c.start, end: c.end }, settings, APP_TIME_ZONE);
      expect(impact.effects).toEqual(c.effects);
    });
  }
});

describe("importantClashes, against the cases the server runs too", () => {
  for (const c of cases.clash) {
    it(c.name, () => {
      const impact: DateImpact = {
        profiled: true,
        effects: c.planned.effects,
        strain: c.planned.strain,
        recoveryDays: c.planned.recoveryDays,
        outdoors: false,
        daylight: false,
        start: Date.parse(c.planned.start),
        end: Date.parse(c.planned.end),
      };
      const event = labelled(Date.parse(c.fact.start), c.fact.level, c.fact.avoid, c.fact.prepDays);
      const [clash] = importantClashes(impact, [event], APP_TIME_ZONE);
      expect(clash?.severity ?? null).toBe(c.expected);
    });
  }
});

describe("dayFactsOf", () => {
  const now = Date.parse("2026-10-07T08:00:00Z");
  const day = 86_400_000;

  it("keeps only important events still to come, and drops everything that could name them", () => {
    const facts = dayFactsOf(
      [
        labelled(now + 3 * day + 31_000, "critical", ["alcohol"], 3),
        labelled(now + 2 * day, "high"),
        labelled(now + day, "normal"),
        labelled(now + day, "low"),
        labelled(now - day, "critical"),
      ],
      now,
    );
    expect(facts).toEqual([
      { start: now + 2 * day, level: "high", avoid: [], prepDays: 0 },
      {
        start: now + 3 * day + 60_000,
        level: "critical",
        avoid: ["alcohol"],
        prepDays: 3,
      },
    ]);
    // Nothing but timing and the label's own words about the days around it.
    expect(Object.keys(facts[0]).sort()).toEqual(["avoid", "level", "prepDays", "start"]);
    expect(JSON.stringify(facts)).not.toContain("Something");
    expect(JSON.stringify(facts)).not.toContain("exam");
  });

  it("sends the soonest when there are more than the server takes", () => {
    const many = Array.from({ length: MAX_FACTS + 5 }, (_, i) =>
      labelled(now + (MAX_FACTS + 5 - i) * 3_600_000, "high"),
    );
    const facts = dayFactsOf(many, now);
    expect(facts).toHaveLength(MAX_FACTS);
    expect(facts[0].start).toBe(now + 3_600_000);
  });

  it("is empty with nothing important ahead", () => {
    expect(dayFactsOf([], now)).toEqual([]);
  });
});
