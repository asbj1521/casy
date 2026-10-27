import { describe, expect, it } from "vitest";

import {
  cityKey,
  dayOptions,
  detectTrips,
  MAX_TRIP_DAYS,
  NO_ANSWERS,
  ROUTINE_COUNT,
  type Leg,
  type Question,
  type TripAnswers,
} from "@/lib/trips";
import { addDays, APP_TIME_ZONE, wallTime } from "@/lib/zone";

/** A moment in Danish time; the month is 1 to 12. */
const at = (month: number, day: number, hour = 0, minute = 0) =>
  wallTime(2026, month - 1, day, hour + minute / 60, APP_TIME_ZONE);

const NOW = at(10, 1, 9);

let counter = 0;
const leg = (
  from: string,
  to: string,
  start: number,
  end: number,
  extra: Partial<Leg> = {},
): Leg => ({
  id: `leg${++counter}`,
  mode: "flight",
  from,
  to,
  start,
  end,
  count: 1,
  ...extra,
});

const answers = (extra: Partial<TripAnswers> = {}): TripAnswers => ({
  ...NO_ANSWERS,
  home: "copenhagen",
  ...extra,
});

describe("cityKey", () => {
  it("ignores case, accents and spacing", () => {
    expect(cityKey("  København ")).toBe("kobenhavn");
    expect(cityKey("Malmö")).toBe("malmo");
    expect(cityKey("New   York")).toBe("new york");
  });
});

describe("a clear round trip", () => {
  const out = leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11, 30));
  const back = leg("oslo", "copenhagen", at(10, 19, 18), at(10, 19, 19, 30));

  it("is away from the flight out to the landing home", () => {
    const { trips, questions } = detectTrips([back, out], answers(), NOW);
    expect(questions).toEqual([]);
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({
      id: out.id,
      start: out.start,
      end: back.end,
      answered: false,
    });
  });

  it("is only a suggestion until the person accepts it", () => {
    const found = detectTrips([out, back], answers(), NOW);
    expect(found.trips[0].accepted).toBe(false);
    expect(found.trips.filter((t) => t.accepted)).toEqual([]);
    expect(found.trips.filter((t) => !t.accepted).map((t) => t.id)).toEqual([out.id]);

    const accepted = detectTrips([out, back], answers({ accepted: [out.id] }), NOW);
    expect(accepted.trips[0].accepted).toBe(true);
    expect(accepted.trips.filter((t) => t.accepted).map((t) => t.id)).toEqual([out.id]);
    expect(accepted.trips.filter((t) => !t.accepted)).toEqual([]);
  });

  it("is not suggested again once declined, even if it was accepted before", () => {
    const { trips } = detectTrips(
      [out, back],
      answers({ accepted: [out.id], dismissed: [out.id] }),
      NOW,
    );
    expect(trips).toEqual([]);
  });

  it("asks which city is home when a single round trip can't say", () => {
    const { trips, questions } = detectTrips([out, back], NO_ANSWERS, NOW);
    expect(trips).toEqual([]);
    expect(questions).toEqual([
      { kind: "home", id: out.id, legs: [out], cities: ["copenhagen", "oslo"] },
    ]);
  });

  it("doesn't ask where home is about journeys that are over", () => {
    expect(detectTrips([out, back], NO_ANSWERS, at(11, 1))).toEqual({ trips: [], questions: [] });
  });

  it("works out home from several trips", () => {
    const other = [
      leg("copenhagen", "rome", at(11, 2, 8), at(11, 2, 11)),
      leg("rome", "copenhagen", at(11, 6, 8), at(11, 6, 11)),
    ];
    const { trips, questions } = detectTrips([out, back, ...other], NO_ANSWERS, NOW);
    expect(questions).toEqual([]);
    expect(trips.map((t) => t.id)).toEqual([out.id, other[0].id]);
  });

  it("leaves a trip the person deleted alone", () => {
    const { trips } = detectTrips([out, back], answers({ dismissed: [out.id] }), NOW);
    expect(trips).toEqual([]);
  });
});

describe("connections", () => {
  it("are part of one journey, not a way home", () => {
    const legs = [
      leg("copenhagen", "amsterdam", at(10, 12, 8), at(10, 12, 9, 30)),
      leg("amsterdam", "new york", at(10, 12, 11), at(10, 12, 19)),
      leg("new york", "amsterdam", at(10, 19, 20), at(10, 20, 8)),
      leg("amsterdam", "copenhagen", at(10, 20, 10), at(10, 20, 11, 30)),
    ];
    const { trips, questions } = detectTrips(legs, answers(), NOW);
    expect(questions).toEqual([]);
    expect(trips).toHaveLength(1);
    expect(trips[0].start).toBe(legs[0].start);
    expect(trips[0].end).toBe(legs[3].end);
    expect(trips[0].legs).toHaveLength(4);
  });

  it("can mix flights, trains and buses", () => {
    const out = leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 12));
    const back = leg("oslo", "copenhagen", at(10, 14, 9), at(10, 14, 17), { mode: "train" });
    expect(detectTrips([out, back], answers(), NOW).trips).toHaveLength(1);
  });
});

describe("what is not a trip", () => {
  it("is a day trip, that never crosses a midnight", () => {
    const legs = [
      leg("copenhagen", "london", at(10, 12, 7), at(10, 12, 8, 30)),
      leg("london", "copenhagen", at(10, 12, 20), at(10, 12, 21, 30)),
    ];
    expect(detectTrips(legs, answers(), NOW)).toEqual({ trips: [], questions: [] });
  });

  it("is a night away, crossing midnight", () => {
    const legs = [
      leg("copenhagen", "london", at(10, 12, 18), at(10, 12, 19, 30)),
      leg("london", "copenhagen", at(10, 13, 17), at(10, 13, 18, 30)),
    ];
    expect(detectTrips(legs, answers(), NOW).trips).toHaveLength(1);
  });

  it("is a routine, a title that occurs again and again", () => {
    const legs = [
      leg("copenhagen", "aarhus", at(10, 5, 7), at(10, 5, 9), {
        mode: "train",
        count: ROUTINE_COUNT,
      }),
      leg("aarhus", "copenhagen", at(10, 9, 16), at(10, 9, 18), {
        mode: "train",
        count: ROUTINE_COUNT,
      }),
    ];
    expect(detectTrips(legs, answers(), NOW)).toEqual({ trips: [], questions: [] });
  });
});

describe("a way out with no way back", () => {
  const out = leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11, 30));

  it("asks when the person is back, from the day after", () => {
    const { trips, questions } = detectTrips([out], answers(), NOW);
    expect(trips).toEqual([]);
    expect(questions).toEqual([
      { kind: "return", id: out.id, legs: [out], earliest: at(10, 13), latest: null },
    ]);
  });

  it("is away through the whole day the person says they are back", () => {
    const { trips, questions } = detectTrips(
      [out],
      answers({ returns: { [out.id]: at(10, 19) } }),
      NOW,
    );
    expect(questions).toEqual([]);
    expect(trips).toEqual([
      {
        id: out.id,
        start: out.start,
        end: at(10, 20),
        legs: [out],
        answered: true,
        accepted: true,
      },
    ]);
  });

  it("is not asked again once the person said it is not a trip", () => {
    expect(detectTrips([out], answers({ dismissed: [out.id] }), NOW)).toEqual({
      trips: [],
      questions: [],
    });
  });

  it("is let go when it is long past", () => {
    expect(detectTrips([out], answers(), at(10, 20))).toEqual({ trips: [], questions: [] });
  });

  it("is still asked about while the person may be away", () => {
    expect(detectTrips([out], answers(), at(10, 13, 12)).questions).toHaveLength(1);
  });

  it("is bounded by the next time the person leaves from home", () => {
    const next = leg("copenhagen", "bergen", at(10, 25, 8), at(10, 25, 9));
    const { questions } = detectTrips([out, next], answers(), NOW);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({ kind: "return", id: out.id, latest: next.start });
  });

  it("is not paired with a way back more than the longest trip later", () => {
    const back = leg(
      "oslo",
      "copenhagen",
      out.start + (MAX_TRIP_DAYS + 1) * 86_400_000,
      out.start + (MAX_TRIP_DAYS + 1) * 86_400_000 + 3_600_000,
    );
    const { trips, questions } = detectTrips([out, back], answers(), NOW);
    expect(trips).toEqual([]);
    expect(questions.map((q) => q.kind)).toEqual(["return", "outbound"]);
  });
});

describe("a way back with no way out", () => {
  const back = leg("oslo", "copenhagen", at(10, 19, 18), at(10, 19, 19, 30));

  it("asks when the person left, up to the day before", () => {
    const { trips, questions } = detectTrips([back], answers(), NOW);
    expect(trips).toEqual([]);
    expect(questions).toEqual([
      { kind: "outbound", id: back.id, legs: [back], earliest: null, latest: at(10, 18) },
    ]);
  });

  it("is away from the start of the day the person says they left", () => {
    const { trips } = detectTrips([back], answers({ outbounds: { [back.id]: at(10, 14) } }), NOW);
    expect(trips).toEqual([
      {
        id: back.id,
        start: at(10, 14),
        end: back.end,
        legs: [back],
        answered: true,
        accepted: true,
      },
    ]);
  });

  it("is not asked about once it has landed", () => {
    expect(detectTrips([back], answers(), at(10, 20)).questions).toEqual([]);
  });
});

describe("dayOptions", () => {
  const out = leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11, 30));
  const ask = (legs: Leg[]) =>
    detectTrips(legs, answers(), NOW).questions[0] as Exclude<Question, { kind: "home" }>;

  it("offers the days after a way out, soonest first", () => {
    const days = dayOptions(ask([out]), NOW);
    expect(days).toHaveLength(MAX_TRIP_DAYS);
    expect(days[0]).toBe(at(10, 13));
    expect(days[1]).toBe(at(10, 14));
  });

  it("stops before the next time the person leaves", () => {
    const next = leg("copenhagen", "bergen", at(10, 16, 8), at(10, 16, 9));
    const days = dayOptions(ask([out, next]), NOW);
    expect(days.at(-1)).toBe(at(10, 16));
  });

  it("starts today for a way out that is under way", () => {
    const days = dayOptions(ask([out]), at(10, 15, 9));
    expect(days[0]).toBe(at(10, 15));
  });

  it("offers the days before a way back, the day before first", () => {
    const back = leg("oslo", "copenhagen", at(10, 19, 18), at(10, 19, 19));
    const days = dayOptions(ask([back]), NOW);
    expect(days[0]).toBe(at(10, 18));
    expect(days[1]).toBe(at(10, 17));
    expect(days).toHaveLength(MAX_TRIP_DAYS);
  });

  it("goes no further back than the person last got home", () => {
    const earlier = [
      leg("copenhagen", "rome", at(10, 10, 8), at(10, 10, 11)),
      leg("rome", "copenhagen", at(10, 14, 8), at(10, 14, 11)),
    ];
    const back = leg("oslo", "copenhagen", at(10, 19, 18), at(10, 19, 19));
    const days = dayOptions(ask([...earlier, back]), NOW);
    expect(days.at(-1)).toBe(at(10, 14));
    expect(days[0]).toBe(addDays(at(10, 19), -1, APP_TIME_ZONE));
  });
});

describe("an accepted trip kept as itself", () => {
  const kept = { start: at(10, 12, 10), end: at(10, 19, 20), city: "Oslo" };

  it("stays when its legs are gone", () => {
    const { trips } = detectTrips([], answers({ accepted: ["t1"], kept: { t1: kept } }), NOW);
    expect(trips).toEqual([
      {
        id: "t1",
        start: kept.start,
        end: kept.end,
        legs: [],
        answered: true,
        accepted: true,
        city: "Oslo",
      },
    ]);
  });

  it("gives way to the trip its legs make, and goes when deleted", () => {
    const out = leg("copenhagen", "oslo", at(10, 12, 10), at(10, 12, 11));
    const back = leg("oslo", "copenhagen", at(10, 19, 18), at(10, 19, 19));
    const both = answers({ accepted: [out.id], kept: { [out.id]: kept } });
    const found = detectTrips([out, back], both, NOW).trips;
    expect(found).toHaveLength(1);
    expect(found[0].legs).toHaveLength(2);
    expect(detectTrips([], { ...both, dismissed: [out.id] }, NOW).trips).toEqual([]);
  });
});

describe("a trip already in the calendar (#165)", () => {
  // Casy's own entry for the trip, as the calendar holds it: whole days, 12 to 19 November.
  const entry = { start: at(11, 12), end: at(11, 20) };
  const out = leg("copenhagen", "oslo", at(11, 12, 10), at(11, 12, 11, 30));

  it("settles a way out inside it, though the answers on the phone are gone", () => {
    expect(detectTrips([out], answers(), NOW, [entry])).toEqual({ trips: [], questions: [] });
  });

  it("settles a way out inside a trip kept as accepted, though the flight's id moved", () => {
    const kept = { start: at(11, 12, 9), end: at(11, 20), city: "Oslo" };
    const moved = { ...out, id: "moved" };
    const { trips, questions } = detectTrips([moved], answers({ kept: { old: kept } }), NOW);
    expect(questions).toEqual([]);
    expect(trips.map((t) => t.id)).toEqual(["old"]);
  });

  it("settles a way back inside it", () => {
    const back = leg("oslo", "copenhagen", at(11, 19, 18), at(11, 19, 19));
    expect(detectTrips([back], answers(), NOW, [entry]).questions).toEqual([]);
  });

  it("doesn't suggest a pair of legs inside it again, but keeps one already accepted", () => {
    const back = leg("oslo", "copenhagen", at(11, 19, 18), at(11, 19, 19));
    expect(detectTrips([out, back], answers(), NOW, [entry]).trips).toEqual([]);
    const accepted = detectTrips([out, back], answers({ accepted: [out.id] }), NOW, [entry]);
    expect(accepted.trips.map((t) => [t.id, t.accepted])).toEqual([[out.id, true]]);
  });

  it("still asks about a journey outside it", () => {
    const later = leg("copenhagen", "rome", at(11, 25, 10), at(11, 25, 12));
    expect(detectTrips([later], answers(), NOW, [entry]).questions.map((q) => q.id)).toEqual([
      later.id,
    ]);
  });
});

describe("a leg lasting more than a day and a half", () => {
  it("is the stay itself, not a journey, so only the flight is asked about", () => {
    const out = leg("copenhagen", "oslo", at(11, 12, 10), at(11, 12, 11, 30));
    // A hand-written "travel to Oslo" over the whole stay, read as a journey from home.
    const stay = leg("copenhagen", "oslo", at(11, 12), at(11, 20), { mode: "train" });
    const { questions } = detectTrips([out, stay], answers(), NOW);
    expect(questions.map((q) => q.id)).toEqual([out.id]);
  });
});
