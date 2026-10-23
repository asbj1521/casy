import { describe, expect, it } from "vitest";

import { da } from "@/i18n/da";
import { en } from "@/i18n/en";
import { periodText } from "@/lib/periodText";

// 23 October 2026, midday in Copenhagen.
const NOW = Date.parse("2026-10-23T10:00:00.000Z");

// Exact days are each a Danish midnight.
describe("periodText for exact days (#134)", () => {
  const nov5 = "2026-11-04T23:00:00.000Z";

  it("reads as until a day when they start today or before", () => {
    const period = { from: "2026-10-22T22:00:00.000Z", to: nov5, days: true as const };
    expect(periodText(period, "da-DK", da, NOW)).toBe("til 5. november");
    expect(periodText(period, "en-GB", en, NOW)).toBe("until 5 November");
  });

  it("names both ends when they start later, and one day as that day", () => {
    const later = { from: "2026-10-27T23:00:00.000Z", to: nov5, days: true as const };
    expect(periodText(later, "da-DK", da, NOW)).toBe("28. okt. til 5. nov.");
    const one = { from: nov5, to: nov5, days: true as const };
    expect(periodText(one, "en-GB", en, NOW)).toBe("on 5 November");
  });

  it("leaves months as they were", () => {
    const december = { from: "2026-11-30T23:00:00.000Z", to: "2026-11-30T23:00:00.000Z" };
    expect(periodText(december, "da-DK", da, NOW)).toBe("i december");
  });
});
