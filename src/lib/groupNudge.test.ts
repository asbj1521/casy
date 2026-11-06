import { describe, expect, it } from "vitest";

import { groupNudge } from "./groupNudge";

const alone = { id: "a", name: "Alene", members: [{}], invited: [] };
const together = { id: "b", name: "Sammen", members: [{}, {}], invited: [] };

describe("groupNudge", () => {
  it("says nothing until both answers are in", () => {
    expect(groupNudge(undefined, [])).toBeNull();
    expect(groupNudge([], undefined)).toBeNull();
  });
  it("offers a group to someone with none", () => {
    expect(groupNudge([], [])).toEqual({ kind: "new" });
  });
  it("offers to invite someone alone in their groups, to the first", () => {
    expect(groupNudge([alone, { ...alone, id: "c" }], [])).toEqual({
      kind: "invite",
      group: { id: "a", name: "Alene" },
    });
  });
  it("is gone once anyone else is in a group", () => {
    expect(groupNudge([alone, together], [])).toBeNull();
  });
  it("is gone once someone has been invited, as they may still answer (#147)", () => {
    expect(groupNudge([{ ...alone, invited: ["p"] }], [])).toBeNull();
  });
  it("is gone once this device has invited someone, whom the server may not list", () => {
    expect(groupNudge([alone], [], (id) => id === "a")).toBeNull();
    expect(groupNudge([alone], [], (id) => id === "x")).not.toBeNull();
  });
  it("stays away while an invitation waits", () => {
    expect(groupNudge([], [{}])).toBeNull();
    expect(groupNudge([alone], [{}])).toBeNull();
  });
});
