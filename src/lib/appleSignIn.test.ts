import type { User } from "@supabase/auth-js";
import { describe, expect, it } from "vitest";

import { hasAppleSignIn, isNewAppleAccount } from "@/lib/appleSignIn";

const NOW = Date.parse("2026-11-08T12:00:00.000Z");
const account = (createdAgo: number, providers: string[]) =>
  ({
    created_at: new Date(NOW - createdAgo).toISOString(),
    identities: providers.map((provider) => ({ provider })),
  }) as unknown as User;

describe("one account, however someone signs in (#245)", () => {
  it("knows an account Apple's sign-in has just made", () => {
    expect(isNewAppleAccount(account(10_000, ["apple"]), NOW)).toBe(true);
  });

  it("leaves alone an account made before, or with another way in", () => {
    expect(isNewAppleAccount(account(10 * 60_000, ["apple"]), NOW)).toBe(false);
    expect(isNewAppleAccount(account(10_000, ["google", "apple"]), NOW)).toBe(false);
    expect(isNewAppleAccount(account(10_000, []), NOW)).toBe(false);
  });

  it("says whether Apple is a way in", () => {
    expect(hasAppleSignIn(account(0, ["email", "apple"]))).toBe(true);
    expect(hasAppleSignIn(account(0, ["google"]))).toBe(false);
  });
});
