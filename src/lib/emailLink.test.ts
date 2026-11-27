import { describe, expect, it } from "vitest";

import { addressAfterLink, emailLinkIn } from "./emailLink";

describe("emailLinkIn", () => {
  it("reads the token and its kind from the auth emails' links", () => {
    expect(emailLinkIn("?lang=da&token_hash=abc&type=magiclink")).toEqual({
      tokenHash: "abc",
      type: "magiclink",
    });
    expect(emailLinkIn("?token_hash=abc&type=recovery")?.type).toBe("recovery");
  });

  it("is none without both, or with a kind Auth doesn't send", () => {
    expect(emailLinkIn("?token_hash=abc")).toBeNull();
    expect(emailLinkIn("?type=magiclink")).toBeNull();
    expect(emailLinkIn("?token_hash=abc&type=sms")).toBeNull();
    expect(emailLinkIn("")).toBeNull();
  });
});

describe("addressAfterLink", () => {
  it("drops the token and keeps the language and where to go next", () => {
    expect(
      addressAfterLink(
        "https://casy.app/sign-in?lang=en&next=%2Fjoin%2Fx&token_hash=a&type=signup",
      ),
    ).toBe("/sign-in?lang=en&next=%2Fjoin%2Fx");
  });

  it("says why when the link failed", () => {
    expect(
      addressAfterLink("https://casy.app/sign-in?token_hash=a&type=magiclink", "Expired"),
    ).toBe("/sign-in?error_description=Expired");
  });
});
