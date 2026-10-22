import { describe, expect, it } from "vitest";

import { summarizePeople } from "@/lib/peopleSummary";
import { NO_PEOPLE_CHOICE } from "@/lib/scheduler";

describe("summarizePeople", () => {
  const ids = ["a", "b", "c", "d"];

  it("is everyone at the start", () => {
    expect(summarizePeople(ids, NO_PEOPLE_CHOICE, true)).toEqual({
      total: 4,
      required: 4,
      optional: 0,
      atLeast: null,
      everyone: true,
    });
  });

  it("counts the optional and the left out", () => {
    const choice = { states: { b: "optional", c: "out" }, atLeast: null } as const;
    expect(summarizePeople(ids, choice, true)).toMatchObject({
      required: 2,
      optional: 1,
      everyone: false,
    });
  });

  it("keeps at least within the required, and only for meetings", () => {
    const choice = { states: { c: "out", d: "out" }, atLeast: 3 } as const;
    expect(summarizePeople(ids, choice, true).atLeast).toBe(2);
    expect(summarizePeople(ids, { states: {}, atLeast: 3 }, false)).toMatchObject({
      atLeast: null,
      everyone: true,
    });
  });
});
