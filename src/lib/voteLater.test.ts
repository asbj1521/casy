import { describe, expect, it } from "vitest";

import { backInFront, onVotesAwayChange, putVotesAway, votesAway } from "@/lib/voteLater";

describe("votes put away (#241)", () => {
  it("come back once the app has been away half an hour, not after a glance elsewhere", () => {
    const hidden = 1_000_000;
    expect(backInFront(hidden + 5 * 60_000, hidden)).toBe(false);
    expect(backInFront(hidden + 30 * 60_000, hidden)).toBe(true);
    expect(backInFront(hidden + 60 * 60_000, null)).toBe(false);
  });

  it("are put away for everyone listening", () => {
    let told = 0;
    const stop = onVotesAwayChange(() => told++);
    expect(votesAway()).toBe(false);
    putVotesAway();
    expect(votesAway()).toBe(true);
    expect(told).toBe(1);
    stop();
  });
});
