import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rememberAskedAboutAi, wasAskedAboutAi } from "@/lib/aiConsent";

/** A plain in-memory stand-in for the browser's localStorage. */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, String(v)),
    removeItem: (k) => void items.delete(k),
    clear: () => items.clear(),
  };
}

describe("asking about the AI using your calendar", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

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
