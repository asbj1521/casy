import { describe, expect, it } from "vitest";

import { participantsFromGroup, type Group, type GroupBusy } from "@/api/groups";

const member = (profileId: string, isYou = false) => ({
  profileId,
  name: profileId,
  isYou,
  joinedAt: "2026-09-01T00:00:00.000Z",
});
const group: Group = {
  id: "g1",
  name: "Venner",
  createdAt: "2026-09-01T00:00:00.000Z",
  createdBy: "anna",
  members: [member("anna", true), member("bo"), member("cy")],
  invited: [],
};
const busy = (connected: string[]): GroupBusy => ({
  busy: Object.fromEntries(
    connected.map((id) => [
      id,
      [{ start: "2026-10-09T16:00:00.000Z", end: "2026-10-09T18:00:00.000Z" }],
    ]),
  ),
  connected: Object.fromEntries(
    group.members.map((m) => [m.profileId, connected.includes(m.profileId)]),
  ),
  truncated: false,
});
const ids = (people: { profileId: string }[]) => people.map((p) => p.profileId);

describe("participantsFromGroup", () => {
  it("searches the members with a calendar and names the others", () => {
    const { participants, waitingFor } = participantsFromGroup(group, busy(["anna", "bo"]));
    expect(ids(participants)).toEqual(["anna", "bo"]);
    expect(ids(waitingFor)).toEqual(["cy"]);
  });

  it("searches everyone as free when nobody has a calendar, so the group still gets dates", () => {
    const { participants, waitingFor } = participantsFromGroup(group, busy([]));
    expect(ids(participants)).toEqual(["anna", "bo", "cy"]);
    expect(ids(waitingFor)).toEqual(["anna", "bo", "cy"]);
    // Free apart from the days nobody is (holidayBlocks.ts).
    for (const p of participants) expect(p.busy.every((b) => b.holiday)).toBe(true);
  });

  it("searches nobody while the busy times are still loading", () => {
    expect(participantsFromGroup(group, undefined).participants).toEqual([]);
  });

  it("names searched members whose calendar is outdated, and still searches them", () => {
    const data = { ...busy(["anna", "bo"]), outdated: { bo: "2026-09-27T10:00:00.000Z", cy: "x" } };
    const { participants, outdated } = participantsFromGroup(group, data);
    expect(ids(participants)).toEqual(["anna", "bo"]);
    // cy has no calendar, so is waited for rather than outdated.
    expect(outdated.map((o) => [o.member.profileId, o.since])).toEqual([
      ["bo", "2026-09-27T10:00:00.000Z"],
    ]);
    expect(participantsFromGroup(group, busy(["anna"])).outdated).toEqual([]);
  });

  it("marks you the way it is asked to", () => {
    const { participants } = participantsFromGroup(group, busy(["anna"]), (n) => `${n} (dig)`);
    expect(participants[0].name).toBe("anna (dig)");
  });
});
