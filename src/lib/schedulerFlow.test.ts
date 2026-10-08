import { describe, expect, it } from "vitest";

import { DEFAULT_EXTRAS, NO_PEOPLE_CHOICE } from "@/lib/scheduler";
import {
  detailsTouched,
  nextStep,
  previousStep,
  searchForStep,
  stepFromSearch,
} from "@/lib/schedulerFlow";

describe("stepFromSearch", () => {
  it("reads the step from the address", () => {
    expect(stepFromSearch("?step=what")).toBe("what");
    expect(stepFromSearch("?step=dates")).toBe("dates");
  });

  it("starts at the group with no step or an unknown one", () => {
    expect(stepFromSearch("")).toBe("group");
    expect(stepFromSearch("?step=nope")).toBe("group");
  });

  it("opens the details for the older ?settings", () => {
    expect(stepFromSearch("?settings")).toBe("details");
  });

  it("round-trips with searchForStep", () => {
    for (const step of ["group", "what", "details", "dates"] as const) {
      expect(stepFromSearch(searchForStep(step))).toBe(step);
    }
  });
});

describe("nextStep and previousStep", () => {
  it("walk the steps in order and stop at the ends", () => {
    expect(nextStep("group")).toBe("what");
    expect(nextStep("details")).toBe("dates");
    expect(nextStep("dates")).toBeNull();
    expect(previousStep("what")).toBe("group");
    expect(previousStep("group")).toBeNull();
  });
});

describe("detailsTouched", () => {
  it("is false as the step starts", () => {
    expect(detailsTouched(DEFAULT_EXTRAS, NO_PEOPLE_CHOICE)).toBe(false);
  });

  it("ignores a place or note of only spaces", () => {
    expect(detailsTouched({ ...DEFAULT_EXTRAS, place: "  " }, NO_PEOPLE_CHOICE)).toBe(false);
  });

  it("notices every setting on the step", () => {
    expect(detailsTouched({ ...DEFAULT_EXTRAS, note: "Snacks" }, NO_PEOPLE_CHOICE)).toBe(true);
    expect(detailsTouched({ ...DEFAULT_EXTRAS, dateCount: 3 }, NO_PEOPLE_CHOICE)).toBe(true);
    expect(detailsTouched({ ...DEFAULT_EXTRAS, answerDays: 5 }, NO_PEOPLE_CHOICE)).toBe(true);
    expect(detailsTouched(DEFAULT_EXTRAS, { states: {}, atLeast: 2 })).toBe(true);
    expect(detailsTouched(DEFAULT_EXTRAS, { states: { a: "optional" }, atLeast: null })).toBe(true);
  });

  it("counts a member set back to Med as untouched", () => {
    expect(detailsTouched(DEFAULT_EXTRAS, { states: { a: "required" }, atLeast: null })).toBe(
      false,
    );
  });
});
