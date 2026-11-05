import { describe, expect, it } from "vitest";

import { da } from "@/i18n/da";
import { en } from "@/i18n/en";
import {
  friendsOutsideGroups,
  groupSwipe,
  inviteExpiryLabel,
  knownPeople,
  looksLikeEmail,
  membershipKey,
} from "@/lib/groups";

describe("inviteExpiryLabel", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");
  const inMs = (ms: number) => new Date(now + ms).toISOString();

  it("counts whole days while there are any", () => {
    expect(inviteExpiryLabel(inMs(7 * 86_400_000), en.inviteExpiry, now)).toBe("7 days");
    expect(inviteExpiryLabel(inMs(86_400_000 + 1000), en.inviteExpiry, now)).toBe("1 day");
  });

  it("falls back to hours on the last day", () => {
    expect(inviteExpiryLabel(inMs(5 * 3_600_000), en.inviteExpiry, now)).toBe("5 hours");
    expect(inviteExpiryLabel(inMs(3_600_000), en.inviteExpiry, now)).toBe("1 hour");
  });

  it("stops counting in the final hour", () => {
    expect(inviteExpiryLabel(inMs(59 * 60_000), en.inviteExpiry, now)).toBe("under an hour");
  });

  it("says so once the link is dead", () => {
    expect(inviteExpiryLabel(inMs(0), en.inviteExpiry, now)).toBe("expired");
    expect(inviteExpiryLabel(inMs(-1000), en.inviteExpiry, now)).toBe("expired");
    expect(inviteExpiryLabel("not a date", en.inviteExpiry, now)).toBe("expired");
  });

  it("speaks Danish too", () => {
    expect(inviteExpiryLabel(inMs(7 * 86_400_000), da.inviteExpiry, now)).toBe("7 dage");
    expect(inviteExpiryLabel(inMs(86_400_000 + 1000), da.inviteExpiry, now)).toBe("1 dag");
    expect(inviteExpiryLabel(inMs(59 * 60_000), da.inviteExpiry, now)).toBe("under en time");
  });
});

describe("knownPeople", () => {
  const you = { profileId: "me", name: "Asbjørn", isYou: true };
  const anna = { profileId: "a", name: "Anna", isYou: false };
  const bo = { profileId: "b", name: "Bo", isYou: false };
  const cille = { profileId: "c", name: "Cille", isYou: false };
  const groups = [
    { id: "g1", name: "Gymnasiet", members: [you, cille, anna] },
    { id: "g2", name: "Kollegerne", members: [you, anna, bo] },
  ];

  it("lists everyone once, by name, with every group you share", () => {
    expect(knownPeople(groups)).toEqual([
      { profileId: "a", name: "Anna", groupNames: ["Gymnasiet", "Kollegerne"] },
      { profileId: "b", name: "Bo", groupNames: ["Kollegerne"] },
      { profileId: "c", name: "Cille", groupNames: ["Gymnasiet"] },
    ]);
  });

  it("leaves out whoever is already in the group being invited to", () => {
    expect(knownPeople(groups, "g2").map((p) => p.name)).toEqual(["Cille"]);
  });

  it("knows nobody without groups", () => {
    expect(knownPeople([])).toEqual([]);
  });
});

describe("looksLikeEmail", () => {
  it("takes an address, spaces around it included", () => {
    expect(looksLikeEmail(" anna@example.dk ")).toBe(true);
  });
  it("catches the usual typos", () => {
    expect(looksLikeEmail("anna")).toBe(false);
    expect(looksLikeEmail("anna@example")).toBe(false);
    expect(looksLikeEmail("an na@example.dk")).toBe(false);
  });
});

describe("membershipKey", () => {
  const m = (...ids: string[]) => ids.map((profileId) => ({ profileId }));

  it("is the same for the same memberships in any order", () => {
    expect(
      membershipKey([
        { id: "g1", members: m("a", "b") },
        { id: "g2", members: m("c") },
      ]),
    ).toBe(
      membershipKey([
        { id: "g2", members: m("c") },
        { id: "g1", members: m("b", "a") },
      ]),
    );
  });

  it("changes when someone joins or leaves", () => {
    const before = membershipKey([{ id: "g1", members: m("a", "b") }]);
    expect(membershipKey([{ id: "g1", members: m("a", "b", "c") }])).not.toBe(before);
    expect(membershipKey([{ id: "g1", members: m("a") }])).not.toBe(before);
  });
});

describe("friends from groups since gone (#222)", () => {
  const groups = [
    {
      id: "g1",
      name: "Fredag",
      members: [
        { profileId: "me", name: "Mig", isYou: true },
        { profileId: "b", name: "Bo", isYou: false },
      ],
    },
  ];
  const friends = [
    { profileId: "b", name: "Bo" },
    { profileId: "c", name: "Cille" },
  ];

  it("can be invited, listed once, with no group to name", () => {
    expect(knownPeople(groups, undefined, friends)).toEqual([
      { profileId: "b", name: "Bo", groupNames: ["Fredag"] },
      { profileId: "c", name: "Cille", groupNames: [] },
    ]);
  });
  it("aren't offered for the group they are already in", () => {
    expect(knownPeople(groups, "g1", friends).map((p) => p.name)).toEqual(["Cille"]);
  });
  it("are listed apart only when no group shows them", () => {
    expect(friendsOutsideGroups(friends, groups)).toEqual([{ profileId: "c", name: "Cille" }]);
  });
});

describe("groupSwipe (#223)", () => {
  it("deletes a group you are alone in, whoever made it", () => {
    expect(groupSwipe({ createdBy: "me", members: [{}] }, "me")).toBe("delete-alone");
    expect(groupSwipe({ createdBy: "other", members: [{}] }, "me")).toBe("delete-alone");
    expect(groupSwipe({ createdBy: null, members: [{}] }, "me")).toBe("delete-alone");
  });
  it("deletes for all only if you made it, and leaves otherwise", () => {
    expect(groupSwipe({ createdBy: "me", members: [{}, {}] }, "me")).toBe("delete-for-all");
    expect(groupSwipe({ createdBy: "other", members: [{}, {}] }, "me")).toBe("leave");
    expect(groupSwipe({ createdBy: null, members: [{}, {}] }, "me")).toBe("leave");
  });
});
