import { describe, expect, it } from "vitest";

import { askedAlready, forgetAskedPhone } from "@/lib/phoneAsk";

describe("asking for the phone's calendar once a launch", () => {
  it("asks each account once, then not again", () => {
    forgetAskedPhone();
    expect(askedAlready("a")).toBe(false);
    expect(askedAlready("a")).toBe(true);
    expect(askedAlready("b")).toBe(false);
  });

  it("asks again after signing out, the same person or another", () => {
    forgetAskedPhone();
    askedAlready("a");
    forgetAskedPhone();
    expect(askedAlready("a")).toBe(false);
  });
});
