import { describe, expect, it } from "vitest";

import { returnPathAfterSignIn } from "./signInReturn";

describe("returnPathAfterSignIn", () => {
  it("returns to where someone was heading", () => {
    expect(returnPathAfterSignIn("/groups/abc")).toBe("/groups/abc");
    expect(returnPathAfterSignIn("/events/e1/dates")).toBe("/events/e1/dates");
    expect(returnPathAfterSignIn("/calendar-overview/accounts?connect=apple")).toBe(
      "/calendar-overview/accounts?connect=apple",
    );
  });

  it("leaves the profile and its screens to the sign-in page's own choice", () => {
    expect(returnPathAfterSignIn("/profile")).toBeNull();
    expect(returnPathAfterSignIn("/profile?password=new")).toBeNull();
    expect(returnPathAfterSignIn("/profile/password")).toBeNull();
    expect(returnPathAfterSignIn("/profile/account")).toBeNull();
  });

  it("still returns to Your data, which the privacy policy links to", () => {
    expect(returnPathAfterSignIn("/profile/data")).toBe("/profile/data");
  });

  it("only treats the profile itself as the profile", () => {
    expect(returnPathAfterSignIn("/profiles")).toBe("/profiles");
  });
});
