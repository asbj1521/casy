import { describe, expect, it } from "vitest";

import { da } from "@/i18n/da";
import { en } from "@/i18n/en";
import { eventTitle, STORED_TITLES, storedEventTitle } from "@/i18n/eventTitle";

describe("event titles", () => {
  it("stores each type by its English name, as en.tsx writes it", () => {
    expect(STORED_TITLES).toEqual(en.eventTypes);
  });

  it("shows a stored type in the reader's language, and anything else as written", () => {
    expect(eventTitle(storedEventTitle("dinner"), da)).toBe(da.eventTypes.dinner);
    expect(eventTitle("Gaming session", da)).toBe(da.eventTypes.gaming);
    expect(eventTitle("Brætspil hos Sara", en)).toBe("Brætspil hos Sara");
  });
});
