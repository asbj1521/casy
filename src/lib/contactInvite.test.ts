import { describe, expect, it } from "vitest";

import { recipientsOf } from "./contactInvite";

describe("recipientsOf", () => {
  it("takes each person's first number, or their email without one", () => {
    expect(
      recipientsOf([
        { name: "Freja", phones: ["+45 12 34 56 78", "+45 87 65 43 21"], emails: ["f@x.dk"] },
        { name: "Oliver", phones: [], emails: ["oliver@x.dk"] },
      ]),
    ).toEqual(["+45 12 34 56 78", "oliver@x.dk"]);
  });

  it("leaves out people with neither, and repeats", () => {
    expect(
      recipientsOf([
        { name: "Nobody", phones: [" "], emails: [] },
        { name: "Sara", phones: ["+45 11 11 11 11"], emails: [] },
        { name: "Sara again", phones: ["+45 11 11 11 11"], emails: [] },
      ]),
    ).toEqual(["+45 11 11 11 11"]);
  });
});
