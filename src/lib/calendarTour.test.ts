import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverviewCalendar } from "@/lib/calendarOverview";
import {
  changesFrom,
  choiceOf,
  readTourSeen,
  rememberTourSeen,
  textOn,
  tourCalendars,
  tourSteps,
  unsortedCalendars,
} from "@/lib/calendarTour";

const calendar = (over: Partial<OverviewCalendar> = {}): OverviewCalendar =>
  ({
    id: "c1",
    name: "Arbejde",
    purpose: null,
    priority: "normal",
    included: true,
    provider: "phone",
    ...over,
  }) as OverviewCalendar;

describe("tourCalendars", () => {
  it("takes every real calendar, those switched off too, and none of Casy's own", () => {
    const off = calendar({ id: "off", included: false });
    const list = [calendar(), off, calendar({ id: "h", provider: "builtin" })];
    expect(tourCalendars(list).map((c) => c.id)).toEqual(["c1", "off"]);
  });
});

describe("choiceOf", () => {
  it("reads a calendar that doesn't count as the slider's lowest stop", () => {
    expect(choiceOf(calendar({ included: false, priority: "never" })).stop).toBe("off");
  });
  it("reads one that counts as its priority", () => {
    expect(choiceOf(calendar({ priority: "never" })).stop).toBe("never");
  });
});

describe("changesFrom", () => {
  it("saves nothing when nothing changed", () => {
    const c = calendar({ purpose: "work" });
    expect(changesFrom(c, choiceOf(c))).toEqual([]);
  });

  it("saves nothing for a calendar left without a category", () => {
    const c = calendar();
    expect(changesFrom(c, choiceOf(c))).toEqual([]);
  });

  it("confirming Casy's guess saves it, so it becomes the person's own", () => {
    const c = calendar({ purpose: "work", purposeGuessed: true });
    expect(changesFrom(c, choiceOf(c))).toEqual([{ purpose: "work" }]);
  });

  it("picks a category, with the person's own name if it has one", () => {
    const c = calendar();
    expect(changesFrom(c, { ...choiceOf(c), purpose: "school" })).toEqual([{ purpose: "school" }]);
    expect(changesFrom(c, { ...choiceOf(c), purpose: "work", categoryName: "Fodbold" })).toEqual([
      { purpose: "work", categoryName: "Fodbold" },
    ]);
  });

  it("taking the person's own name off is a change, though the kind stays", () => {
    const c = calendar({ purpose: "work", categoryName: "Fodbold" });
    expect(changesFrom(c, { ...choiceOf(c), categoryName: null })).toEqual([{ purpose: "work" }]);
  });

  it("the lowest stop switches it off, and leaves its priority for when it is back", () => {
    expect(
      changesFrom(calendar({ priority: "never" }), {
        purpose: null,
        categoryName: null,
        stop: "off",
      }),
    ).toEqual([{ included: false }]);
  });

  it("a stop above switches it on and sets its priority", () => {
    const c = calendar({ included: false });
    expect(changesFrom(c, { ...choiceOf(c), stop: "normal" })).toEqual([{ included: true }]);
    expect(changesFrom(c, { ...choiceOf(c), stop: "never" })).toEqual([
      { included: true },
      { priority: "never" },
    ]);
  });
});

describe("textOn", () => {
  it("is white on a dark colour and black on a light one", () => {
    expect(textOn("0, 122, 255")).toBe("#ffffff");
    expect(textOn("52, 199, 89")).toBe("#1c1c1e");
    expect(textOn("255, 204, 0")).toBe("#1c1c1e");
  });
});

describe("the calendars wanting a look", () => {
  const none = new Set<string>();

  it("are those with no category or only Casy's guess", () => {
    const list = [
      calendar({ id: "blank" }),
      calendar({ id: "guess", purpose: "work", purposeGuessed: true }),
      calendar({ id: "sorted", purpose: "work" }),
    ];
    expect(unsortedCalendars(list, none).map((c) => c.id)).toEqual(["blank", "guess"]);
  });

  it("leave out what doesn't count, and Casy's own", () => {
    const list = [
      calendar({ id: "off", included: false }),
      calendar({ id: "h", provider: "builtin" }),
    ];
    expect(unsortedCalendars(list, none)).toEqual([]);
  });

  it("leave out one already gone through, so the count can reach nothing", () => {
    expect(unsortedCalendars([calendar({ id: "blank" })], new Set(["blank"]))).toEqual([]);
  });

  it("are what the tour goes through, or with none left, every calendar", () => {
    const blank = calendar({ id: "blank" });
    const sorted = calendar({ id: "sorted", purpose: "work" });
    expect(tourSteps([blank, sorted], none).map((c) => c.id)).toEqual(["blank"]);
    expect(tourSteps([sorted], none).map((c) => c.id)).toEqual(["sorted"]);
  });
});

describe("what has been gone through", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is remembered per person", () => {
    expect(readTourSeen("a").size).toBe(0);
    rememberTourSeen("a", new Set(["c1"]));
    expect([...readTourSeen("a")]).toEqual(["c1"]);
    expect(readTourSeen("b").size).toBe(0);
  });

  it("survives something unreadable in storage", () => {
    localStorage.setItem("casy-calendar-tour-seen:a", "not json");
    expect(readTourSeen("a").size).toBe(0);
  });
});
