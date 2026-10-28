import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_ASKS, mayAsk, readAskState, recordAsk } from "@/lib/pushAsk";

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

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-28T12:00:00Z");

describe("mayAsk", () => {
  it("asks someone who has never been asked", () => {
    expect(mayAsk({ asked: 0, last: null }, "prompt", NOW)).toBe(true);
  });

  it("never asks once iOS has an answer, yes or no: its prompt shows only once", () => {
    expect(mayAsk({ asked: 0, last: null }, "granted", NOW)).toBe(false);
    expect(mayAsk({ asked: 0, last: null }, "denied", NOW)).toBe(false);
  });

  it("waits a week after a not now", () => {
    expect(mayAsk({ asked: 1, last: NOW - 6 * DAY }, "prompt", NOW)).toBe(false);
    expect(mayAsk({ asked: 1, last: NOW - 7 * DAY }, "prompt", NOW)).toBe(true);
  });

  it("stops after three times", () => {
    expect(MAX_ASKS).toBe(3);
    expect(mayAsk({ asked: 2, last: NOW - 30 * DAY }, "prompt", NOW)).toBe(true);
    expect(mayAsk({ asked: 3, last: NOW - 30 * DAY }, "prompt", NOW)).toBe(false);
  });
});

describe("the asking remembered on the phone", () => {
  beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("starts empty and counts each time the sheet was shown", () => {
    expect(readAskState()).toEqual({ asked: 0, last: null });
    recordAsk(NOW);
    recordAsk(NOW + DAY);
    expect(readAskState()).toEqual({ asked: 2, last: NOW + DAY });
  });

  it("reads a damaged value as never asked", () => {
    localStorage.setItem("casy-push-ask", "{nope");
    expect(readAskState()).toEqual({ asked: 0, last: null });
  });
});
