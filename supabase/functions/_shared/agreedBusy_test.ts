import { assertEquals } from "jsr:@std/assert@1";

import { agreedBusy, type AgreedInvite } from "./agreedBusy.ts";

const from = new Date("2026-10-01T00:00:00Z");
const to = new Date("2026-12-01T00:00:00Z");

function invite(
  profile: string,
  dates: Partial<AgreedInvite["event_proposals"]["event_proposal_dates"][number]>[],
): AgreedInvite {
  return {
    profile_id: profile,
    event_proposals: {
      event_proposal_dates: dates.map((d, i) => ({
        id: `d${i}`,
        starts_at: "2026-11-27T17:00:00Z",
        ends_at: "2026-11-27T22:00:00Z",
        declined_at: null,
        created_at: "2026-10-01T00:00:00Z",
        chosen_at: null,
        ...d,
      })),
    },
  };
}

Deno.test("an agreed event is busy for those going, at its decided date only (#172)", () => {
  const vote = [{ starts_at: "2026-11-20T17:00:00Z" }, { chosen_at: "2026-10-10T00:00:00Z" }];
  const busy = agreedBusy([invite("anna", vote), invite("bo", vote)], new Set(["d1:bo"]), from, to);
  assertEquals(busy.get("anna"), [{ start: "2026-11-27T17:00:00Z", end: "2026-11-27T22:00:00Z" }]);
  // Bo said no to the date decided: not his to keep free.
  assertEquals(busy.has("bo"), false);
});

Deno.test("an agreed event outside the search's stretch isn't sent", () => {
  const later = [
    {
      chosen_at: "2026-10-10T00:00:00Z",
      starts_at: "2027-01-05T17:00:00Z",
      ends_at: "2027-01-05T20:00:00Z",
    },
  ];
  assertEquals(agreedBusy([invite("anna", later)], new Set(), from, to).size, 0);
});
