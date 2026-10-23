import { describe, expect, it } from "vitest";

import { NO_PEOPLE_CHOICE, type SchedulerSettings } from "@/lib/scheduler";
import { widenOptions, type WidenInput } from "@/lib/widen";
import type { Participant } from "@/types";

const TZ = "UTC";
// Thursday 1 October 2026, and the year searched from it.
const TODAY = "2026-10-01T00:00:00.000Z";
const LIMIT = { start: TODAY, end: "2027-10-01T00:00:00.000Z" };
const OCTOBER = { from: TODAY, to: TODAY };

function person(name: string, busy: Array<[string, string]>): Participant {
  return {
    profileId: name.toLowerCase(),
    name,
    busy: busy.map(([start, end]) => ({ start, end })),
  };
}

/** Busy every evening of October from 17:00 to 23:00. */
const octoberEvenings = (): Array<[string, string]> =>
  Array.from({ length: 31 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return [`2026-10-${day}T17:00:00.000Z`, `2026-10-${day}T23:00:00.000Z`];
  });

const DINNER: SchedulerSettings = {
  multiDay: false,
  startHour: 18,
  durationMinutes: 180,
  dows: [5, 6],
  anyTime: false,
  startWindow: null,
  days: 3,
  startDow: 5,
  period: OCTOBER,
};

function input(participants: Participant[], settings: SchedulerSettings): WidenInput {
  return {
    participants,
    settings,
    members: participants.map((p) => p.profileId),
    choice: NO_PEOPLE_CHOICE,
    today: TODAY,
    limit: LIMIT,
    timeZone: TZ,
    now: Date.parse(TODAY),
  };
}

describe("widenOptions (#135)", () => {
  it("offers only what finds a date, each with its first date, earliest first", () => {
    // Anna is out every October evening; the others are free.
    const group = [person("Anna", octoberEvenings()), person("Bo", []), person("Carl", [])];
    const options = widenOptions(input(group, DINNER));
    const kinds = options.map((o) => o.widening.kind);
    // Another part of the day works on Friday 2 October; so do the two
    // without Anna; more months only in November. More weekdays and shorter
    // still clash with her evenings, so they aren't offered.
    expect(kinds).toEqual(["time", "people", "months"]);
    expect(options[0].widening).toEqual({ kind: "time", part: "morning" });
    expect(options[0].first.slot.start).toBe("2026-10-02T09:00:00.000Z");
    expect(options[1].first.absent).toEqual([{ profileId: "anna", name: "Anna" }]);
    expect(options[2].settings.period?.to).toBe("2026-11-01T00:00:00.000Z");
  });

  it("finds the longest shorter meeting that fits", () => {
    // Free 18:00 to 20:00 only, on Fridays and Saturdays of October.
    const busy = octoberEvenings().map(([, end]): [string, string] => [
      end.replace("T23", "T20"),
      end,
    ]);
    const options = widenOptions(input([person("Anna", busy)], DINNER));
    expect(options.find((o) => o.widening.kind === "shorter")?.widening).toEqual({
      kind: "shorter",
      minutes: 120,
    });
  });

  it("never widens past exact days the AI set", () => {
    const group = [person("Anna", octoberEvenings())];
    const until = { from: TODAY, to: "2026-10-31T00:00:00.000Z", days: true as const };
    const options = widenOptions(input(group, { ...DINNER, period: until }));
    expect(options.some((o) => o.widening.kind === "months")).toBe(false);
  });

  it("lets a trip start on another day, or be shorter", () => {
    // Away every weekend in October, Friday to Sunday.
    const weekends: Array<[string, string]> = [
      ["2026-10-02T00:00:00.000Z", "2026-10-05T00:00:00.000Z"],
      ["2026-10-09T00:00:00.000Z", "2026-10-12T00:00:00.000Z"],
      ["2026-10-16T00:00:00.000Z", "2026-10-19T00:00:00.000Z"],
      ["2026-10-23T00:00:00.000Z", "2026-10-26T00:00:00.000Z"],
      ["2026-10-30T00:00:00.000Z", "2026-11-02T00:00:00.000Z"],
    ];
    const trip = { ...DINNER, multiDay: true, days: 3, startDow: 5, dows: [...DINNER.dows] };
    const kinds = widenOptions(input([person("Anna", weekends)], trip)).map((o) => o.widening.kind);
    expect(kinds).toContain("startDay");
    expect(kinds).toContain("months");
  });
});
