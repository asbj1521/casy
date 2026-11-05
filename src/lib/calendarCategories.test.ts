import { describe, expect, it } from "vitest";

import { categoryLabel, ownCategories, type OverviewCalendar } from "./calendarOverview";

const calendar = (purpose: OverviewCalendar["purpose"], categoryName?: string | null) =>
  ({ purpose, categoryName }) as OverviewCalendar;
const words = { work: "Arbejde", school: "Skole", personal: "Privat", other: "Andet" };

describe("own categories (#220)", () => {
  it("are listed once each, sorted, and by the first calendar's kind", () => {
    expect(
      ownCategories([
        calendar("work", "Fodbold"),
        calendar("personal", "fodbold"),
        calendar("personal", "Bandet"),
        calendar("work"),
        calendar(null),
      ]),
    ).toEqual([
      { name: "Bandet", purpose: "personal" },
      { name: "Fodbold", purpose: "work" },
    ]);
  });

  it("a calendar reads by its own name first, then its kind, then none", () => {
    expect(categoryLabel(calendar("work", "Fodbold"), words, "Ingen")).toBe("Fodbold");
    expect(categoryLabel(calendar("work"), words, "Ingen")).toBe("Arbejde");
    expect(categoryLabel(calendar(null), words, "Ingen")).toBe("Ingen");
  });
});
