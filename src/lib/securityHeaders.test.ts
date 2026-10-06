import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Content-Security-Policy in vercel.json (#86): only Casy's own scripts
 * run, so an injected script can't read the login kept in localStorage. These
 * keep it honest as the code changes: nothing that would let inline or
 * evaluated script back in, and every outside place the code really talks to
 * still allowed (or that feature breaks on the live site, and only there).
 */
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  headers: { headers: { key: string; value: string }[] }[];
};
const csp = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
const directive = (name: string) =>
  csp
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? [];
const source = (path: string) => readFileSync(path, "utf8");

describe("Content-Security-Policy", () => {
  it("runs only Casy's own scripts, and Turnstile's", () => {
    expect(directive("script-src")).toEqual(["'self'", "https://challenges.cloudflare.com"]);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
  });

  it("allows Turnstile, which the sign-in page loads", () => {
    expect(source("src/hooks/useCaptcha.ts")).toContain("https://challenges.cloudflare.com/");
    expect(directive("frame-src")).toContain("https://challenges.cloudflare.com");
  });

  it("allows Have I Been Pwned, which the password check calls", () => {
    expect(source("src/lib/passwordRules.ts")).toContain("https://api.pwnedpasswords.com/");
    expect(directive("connect-src")).toContain("https://api.pwnedpasswords.com");
  });

  it("allows the Supabase project over HTTPS and, for live updates, WebSocket", () => {
    const hosts = directive("connect-src").filter((s) => s.includes(".supabase.co"));
    expect(hosts).toHaveLength(2);
    const [https, wss] = [
      hosts.find((h) => h.startsWith("https://")),
      hosts.find((h) => h.startsWith("wss://")),
    ];
    expect(https?.replace("https://", "")).toBe(wss?.replace("wss://", ""));
  });
});
