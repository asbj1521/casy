import { describe, expect, it } from "vitest";

import { accountKindsFor } from "./autoCategorize";
import { calendarColors, type OverviewCalendar } from "./calendarOverview";
import { phoneCalendarColors } from "./phoneEvents";

const info = (id: string, color: string, accountKind = "icloud") => ({ id, color, accountKind });
const calendar = (id: string, purpose: OverviewCalendar["purpose"]) =>
  ({ id, purpose }) as OverviewCalendar;

describe("Apple's colours (#220)", () => {
  const ids = new Map([["ek-home", "home"]]);

  it("takes this phone's calendars only, and none it couldn't read", () => {
    const colors = phoneCalendarColors(
      [info("ek-home", "1, 2, 3"), info("ek-other", "4, 5, 6"), info("ek-home-2", "")],
      new Map([...ids, ["ek-home-2", "two"]]),
    );
    expect([...colors]).toEqual([["home", "1, 2, 3"]]);
  });

  it("wins over the category's colour, which the others keep", () => {
    const colors = calendarColors(
      [calendar("home", "work"), calendar("office", "work")],
      new Map([["home", "1, 2, 3"]]),
    );
    expect(colors.get("home")).toBe("1, 2, 3");
    expect(colors.get("office")).toBe("59, 130, 246");
  });
});

describe("the account's kind for the sorting (#220)", () => {
  it("goes only for the calendars asked about", () => {
    const kinds = accountKindsFor(
      [info("ek-a", "", "exchange"), info("ek-b", "", "icloud"), info("ek-gone", "", "local")],
      new Map([
        ["ek-a", "a"],
        ["ek-b", "b"],
      ]),
      new Set(["a"]),
    );
    expect(kinds).toEqual({ a: "exchange" });
  });
});
