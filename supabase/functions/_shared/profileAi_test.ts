import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildProfileMessage,
  cleanProfile,
  describePlan,
  type EventToProfile,
  PROFILE_SCHEMA,
  PROFILE_VERSION,
  profileFromAnswer,
  readProfileRequest,
} from "./profileAi.ts";

const event = (over: Partial<EventToProfile> = {}): EventToProfile => ({
  title: "Fredagsbar",
  place: "",
  note: "",
  kind: "meeting",
  startMinute: 16 * 60,
  minutes: 240,
  days: 1,
  ...over,
});

Deno.test("describePlan says the kind, start and length", () => {
  assertEquals(describePlan(event()), "meeting at 16:00 for 4 h");
  assertEquals(
    describePlan(event({ startMinute: 1170, minutes: 90 })),
    "meeting at 19:30 for 1 h 30 min",
  );
  assertEquals(
    describePlan(event({ startMinute: -1, minutes: 60 })),
    "meeting at any time for 1 h",
  );
  assertEquals(describePlan(event({ kind: "trip", days: 3 })), "trip of 3 days");
  assertEquals(describePlan(event({ kind: "holiday", days: 1 })), "holiday of 1 day");
});

Deno.test("the message carries only what was typed, in the language asked for", () => {
  assertEquals(
    buildProfileMessage(event(), "da"),
    'Write the reason in Danish.\n\nThe event:\n{"name":"Fredagsbar","plan":"meeting at 16:00 for 4 h"}',
  );
  const full = buildProfileMessage(
    event({ place: "Mikkeller", note: "Vi tager videre bagefter" }),
    "en",
  );
  assertStringIncludes(full, "Write the reason in English.");
  assertStringIncludes(full, '"place":"Mikkeller","note":"Vi tager videre bagefter"');
});

Deno.test("readProfileRequest cleans the event and keeps numbers in range", () => {
  assertEquals(readProfileRequest(null), null);
  assertEquals(readProfileRequest({ title: "Fest", kind: "party" }), null);
  assertEquals(readProfileRequest({ title: "  ", kind: "meeting" }), null);
  assertEquals(
    readProfileRequest({ title: " Fest ", kind: "meeting", startMinute: 5000, minutes: 1 }),
    {
      title: "Fest",
      place: "",
      note: "",
      kind: "meeting",
      startMinute: 1439,
      minutes: 15,
      days: 1,
    },
  );
  // A trip has days, not a start or length.
  assertEquals(readProfileRequest({ title: "Berlin", kind: "trip", startMinute: 600, days: 3 }), {
    title: "Berlin",
    place: "",
    note: "",
    kind: "trip",
    startMinute: -1,
    minutes: 0,
    days: 3,
  });
});

Deno.test("cleanProfile snaps the answer into its limits and fills what is missing", () => {
  assertEquals(cleanProfile("x"), null);
  assertEquals(
    cleanProfile({
      effects: ["alcohol", "drugs", "lateNight", "alcohol"],
      runsLate: "yes",
      strain: "extreme",
      recoveryDays: 9,
      outdoors: true,
      confidence: "sure",
      reason: "x".repeat(400),
      extra: 1,
    }),
    {
      v: PROFILE_VERSION,
      effects: ["lateNight", "alcohol"],
      runsLate: false,
      strain: "light",
      recoveryDays: 3,
      outdoors: true,
      daylight: false,
      confidence: "low",
      reason: "x".repeat(140),
    },
  );
  // An older, smaller profile still reads.
  assertEquals(cleanProfile({ effects: ["exercise"] })?.effects, ["exercise"]);
});

Deno.test("profileFromAnswer needs a finished, readable answer", () => {
  const text = JSON.stringify({ effects: ["alcohol"], strain: "moderate" });
  assertEquals(profileFromAnswer("end_turn", text)?.strain, "moderate");
  assertEquals(profileFromAnswer("max_tokens", text), null);
  assertEquals(profileFromAnswer("end_turn", "not json"), null);
});

Deno.test("the schema has no nullable fields (structured outputs limit them)", () => {
  assertEquals(JSON.stringify(PROFILE_SCHEMA).includes("null"), false);
});
