import { describe, expect, it } from "vitest";

import { APP_PASSWORD_EXAMPLE, looksLikeAppSpecificPassword } from "@/lib/appleCredentials";

describe("looksLikeAppSpecificPassword", () => {
  it("accepts the shape Apple shows, including the example people are shown", () => {
    expect(looksLikeAppSpecificPassword("abcd-efgh-ijkl-mnop")).toBe(true);
    expect(looksLikeAppSpecificPassword(APP_PASSWORD_EXAMPLE)).toBe(true);
  });

  it("accepts it without the dashes, and in either case", () => {
    expect(looksLikeAppSpecificPassword("abcdefghijklmnop")).toBe(true);
    expect(looksLikeAppSpecificPassword("ABCD-EFGH-IJKL-MNOP")).toBe(true);
  });

  it("ignores the stray spaces a paste brings along", () => {
    expect(looksLikeAppSpecificPassword("  abcd-efgh-ijkl-mnop\n")).toBe(true);
  });

  it("flags what a normal Apple password looks like", () => {
    expect(looksLikeAppSpecificPassword("Sommer2026!")).toBe(false);
    expect(looksLikeAppSpecificPassword("correcthorsebatterystaple")).toBe(false);
  });

  it("flags one that is cut short or mistyped", () => {
    expect(looksLikeAppSpecificPassword("abcd-efgh-ijkl")).toBe(false);
    expect(looksLikeAppSpecificPassword("abcd-efgh-ijkl-mno1")).toBe(false);
    expect(looksLikeAppSpecificPassword("abcd efgh ijkl mnop")).toBe(false);
    expect(looksLikeAppSpecificPassword("abcd-efgh-ijklm-nop")).toBe(false);
  });

  it("says no to nothing at all; the form decides whether that is worth a warning", () => {
    expect(looksLikeAppSpecificPassword("")).toBe(false);
    expect(looksLikeAppSpecificPassword("   ")).toBe(false);
  });
});
