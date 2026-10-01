import { describe, expect, it } from "vitest";

import { authOptions } from "@/lib/supabase";

describe("authOptions", () => {
  it("keeps the session under supabase-js's storage key, so nobody is signed out", () => {
    expect(authOptions("https://abcdefgh.supabase.co", "k").storageKey).toBe(
      "sb-abcdefgh-auth-token",
    );
  });

  it("points at the project's auth API, with or without a trailing slash", () => {
    expect(authOptions("https://abcdefgh.supabase.co", "k").url).toBe(
      "https://abcdefgh.supabase.co/auth/v1",
    );
    expect(authOptions("https://abcdefgh.supabase.co/", "k").url).toBe(
      "https://abcdefgh.supabase.co/auth/v1",
    );
  });

  it("sends the publishable key the way supabase-js did", () => {
    expect(authOptions("https://abcdefgh.supabase.co", "pk").headers).toEqual({
      Authorization: "Bearer pk",
      apikey: "pk",
    });
  });
});
