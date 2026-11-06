import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverviewCalendar } from "@/lib/calendarOverview";
import {
  changesFrom,
  choiceOf,
  rememberTourOffered,
  textOn,
  tourCalendars,
  wasTourOffered,
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

describe("the tour's flag", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is per person", () => {
    expect(wasTourOffered("a")).toBe(false);
    rememberTourOffered("a");
    expect(wasTourOffered("a")).toBe(true);
    expect(wasTourOffered("b")).toBe(false);
  });
});
