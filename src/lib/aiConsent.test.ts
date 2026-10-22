import { beforeEach, describe, expect, it } from "vitest";

import { rememberAskedAboutAi, wasAskedAboutAi } from "@/lib/aiConsent";

describe("asking about the AI using your calendar", () => {
  beforeEach(() => localStorage.clear());

  it("asks until someone says not now, per person", () => {
    expect(wasAskedAboutAi("a")).toBe(false);
    rememberAskedAboutAi("a");
    expect(wasAskedAboutAi("a")).toBe(true);
    expect(wasAskedAboutAi("b")).toBe(false);
  });

  it("asks again when the wording is wider than the one answered", () => {
    localStorage.setItem("casy-ai-consent-asked:a", "0");
    expect(wasAskedAboutAi("a")).toBe(false);
  });
});
