import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let startAnswer: () => Promise<unknown> = async () => ({});

vi.mock("@/lib/supabaseFunctions", () => ({
  callFunction: vi.fn(async (name: string, opts: { body?: { action?: string } }) => {
    calls.push(`${name}:${opts?.body?.action ?? ""}`);
    if (opts?.body?.action === "start") return startAnswer();
    return {};
  }),
}));

const { firstFromStart } = await import("@/api/start");

const own = (value: string) => vi.fn(async () => value);

describe("firstFromStart", () => {
  afterEach(() => {
    calls.length = 0;
    vi.useRealTimers();
  });

  it("serves each question's first fetch from one start call", async () => {
    startAnswer = async () => ({ whoami: "me", groups: "g", pulse: "p" });
    const ownWho = own("own-me");
    expect(await firstFromStart("u1", "whoami", ownWho as never)).toBe("me");
    expect(await firstFromStart("u1", "groups", own("own-g") as never)).toBe("g");
    expect(calls).toEqual(["groups:start"]);
    expect(ownWho).not.toHaveBeenCalled();
  });

  it("asks on its own the second time, and when start says nothing of it", async () => {
    startAnswer = async () => ({ whoami: "me" });
    await firstFromStart("u2", "whoami", own("x") as never);
    const again = own("fresh");
    expect(await firstFromStart("u2", "whoami", again as never)).toBe("fresh");
    expect(again).toHaveBeenCalledOnce();
    const missing = own("own-invitations");
    expect(await firstFromStart("u2", "invitations", missing as never)).toBe("own-invitations");
  });

  it("asks on its own when the server has no start yet", async () => {
    startAnswer = async () => Promise.reject(new Error("Unknown action"));
    expect(await firstFromStart("u3", "groups", own("own-g") as never)).toBe("own-g");
  });

  it("never hands out an answer older than a few seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    startAnswer = async () => ({ whoami: "me", groups: "old" });
    await firstFromStart("u4", "whoami", own("x") as never);
    vi.setSystemTime(new Date("2026-10-07T10:00:30Z"));
    expect(await firstFromStart("u4", "groups", own("new") as never)).toBe("new");
  });
});
