import { describe, expect, it } from "vitest";

import { comfortNotes, type ComfortWords } from "@/lib/comfortNotes";
import type { Penalty } from "@/lib/dateComfort";
import type { EdgeWarning } from "@/lib/earlyMorning";

const words: ComfortWords = {
  you: "Du",
  tightBefore: (who) => `before: ${who}`,
  tightAfter: (who) => `after: ${who}`,
  squeezed: (who) => `squeezed: ${who}`,
  earlyAfterLate: (who) => `early: ${who}`,
  schoolNight: "school night",
  afterDark: "after dark",
  familyDay: "family day",
  longWeekend: "long weekend",
  soon: "soon",
  farAhead: "far ahead",
};
const names: Record<string, string> = { a: "Anna", b: "Ben", c: "Carl" };
const say = (
  penalties: Penalty[],
  youId: string | null = null,
  warnings: EdgeWarning[] | null = null,
) =>
  comfortNotes(penalties, { nameOf: (id) => names[id], youId, lang: "da", words, warnings }).map(
    (n) => n.text,
  );
const p = (rule: Penalty["rule"], points: number, who?: string): Penalty => ({ rule, points, who });

describe("comfortNotes", () => {
  it("says nothing for a date with nothing to say", () => {
    expect(say([])).toEqual([]);
  });

  it("names the people a rule cost, you first", () => {
    expect(say([p("tightBefore", 3, "a"), p("tightBefore", 4, "b")])).toEqual([
      "before: Anna og Ben",
    ]);
    expect(say([p("tightBefore", 3, "a"), p("tightBefore", 4, "b")], "b")).toEqual([
      "before: Du og Anna",
    ]);
  });

  it("leaves out a penalty too small to matter", () => {
    expect(say([p("tightBefore", 1.9, "a"), p("tightAfter", 0.5, "b")])).toEqual([]);
  });

  it("says squeezed instead of tight before and after for the same person", () => {
    const squeezed = [p("tightBefore", 3, "a"), p("tightAfter", 2, "a"), p("sandwiched", 2.5, "a")];
    expect(say(squeezed)).toEqual(["squeezed: Anna"]);
  });

  it("says the date's own penalties once, and a bonus as no mark against it", () => {
    const notes = comfortNotes([p("notice", 10), p("dayOfYear", -4), p("farAhead", 3)], {
      nameOf: (id) => id,
      youId: null,
      lang: "da",
      words,
      warnings: null,
    });
    expect(notes).toEqual([
      { text: "long weekend", notable: false },
      { text: "soon", notable: true },
      { text: "far ahead", notable: false },
    ]);
  });

  it("leaves out what the edge warnings already say", () => {
    const warnings: EdgeWarning[] = [
      { kind: "backToBack", text: "x" },
      { kind: "earlyMorning", text: "y" },
      { kind: "newYearsDay", text: "z" },
    ];
    const all = [
      p("tightBefore", 4, "a"),
      p("sandwiched", 3, "a"),
      p("tightAfter", 3, "b"),
      p("earlyAfterLate", 10, "a"),
      p("dayOfYear", 4),
    ];
    expect(say(all, null, warnings)).toEqual(["after: Ben"]);
    expect(say(all)).toContain("early: Anna");
  });
});
