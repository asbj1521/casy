import { describe, expect, it, vi } from "vitest";

import {
  breachCount,
  checkPassword,
  passesChecks,
  personalWords,
  sha1Hex,
  timesLeaked,
} from "@/lib/passwordRules";

describe("checkPassword", () => {
  it("wants at least 8 characters", () => {
    expect(checkPassword("abc1234", []).length).toBe(false);
    expect(checkPassword("abcd1234", []).length).toBe(true);
  });

  it("wants both an a-z letter and a digit, like Supabase's letters_digits", () => {
    expect(checkPassword("12345678", []).lettersAndDigits).toBe(false);
    expect(checkPassword("password", []).lettersAndDigits).toBe(false);
    // Only letters outside a-z don't count, exactly as on the server.
    expect(checkPassword("æøåæøå12", []).lettersAndDigits).toBe(false);
    expect(checkPassword("Password1", []).lettersAndDigits).toBe(true);
  });

  it("refuses a password built from the person's email or name", () => {
    const personal = personalWords(["anna.jensen@example.com", "Anna Jensen"]);
    expect(checkPassword("AnnaJensen99", personal).notPersonal).toBe(false);
    expect(checkPassword("jensen2026x", personal).notPersonal).toBe(false);
    expect(checkPassword("blue-kite-47", personal).notPersonal).toBe(true);
  });

  it("passes only when every rule does", () => {
    expect(passesChecks(checkPassword("blue-kite-47", []))).toBe(true);
    expect(passesChecks(checkPassword("12345678", []))).toBe(false);
  });
});

describe("personalWords", () => {
  it("keeps the address, its name part and each word, skipping short bits", () => {
    expect(personalWords(["bo.li@x.dk", null, "Bo Andersen"]).sort()).toEqual(
      ["andersen", "boandersen", "boli", "bolixdk"].sort(),
    );
  });
});

describe("the leak check", () => {
  it("hashes like Have I Been Pwned lists them", async () => {
    expect(await sha1Hex("password")).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("finds the suffix in a range answer, and never counts padding", () => {
    const answer = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\nAAAA:0";
    expect(breachCount(answer, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(9545824);
    expect(breachCount(answer, "AAAA")).toBe(0);
    expect(breachCount(answer, "FFFF")).toBe(0);
  });

  it("sends only the first 5 characters of the hash, with padding asked for", async () => {
    const fetchImpl = vi.fn(async () => new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:42"));
    expect(await timesLeaked("password", fetchImpl as unknown as typeof fetch)).toBe(42);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    // The whole request: the first 5 characters of the hash, nothing else.
    expect(url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  it("gives up quietly when the service can't be reached", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("network down");
    });
    expect(await timesLeaked("password", down as unknown as typeof fetch)).toBeNull();
    const error = vi.fn(async () => new Response("", { status: 503 }));
    expect(await timesLeaked("password", error as unknown as typeof fetch)).toBeNull();
  });
});
