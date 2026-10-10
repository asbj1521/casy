import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildLabelMessage,
  buildRelabelMessage,
  cleanLabel,
  describeTiming,
  type EventLabel,
  type EventToLabel,
  LABEL_SCHEMA,
  labelsFromAnswer,
  MAX_EVENTS,
  MAX_PREP_DAYS,
  readEvent,
  readEvents,
} from "./labelAi.ts";

const event = (over: Partial<EventToLabel> = {}): EventToLabel => ({
  title: "Eksamen statistik",
  calendar: "Uni",
  allDay: false,
  startMinute: 9 * 60,
  minutes: 240,
  days: 1,
  count: 1,
  ...over,
});

const label = (over: Partial<EventLabel> = {}): EventLabel => ({
  kind: "exam",
  importance: "critical",
  prepDays: 3,
  avoidBefore: ["lateNight", "alcohol"],
  recoveryDays: 0,
  strain: "heavy",
  confidence: "high",
  reason: "Eksamen: hold aftenen før fri.",
  ...over,
});

Deno.test("describeTiming says all day or the usual start and length", () => {
  assertEquals(describeTiming(event()), "09:00, 4 h");
  assertEquals(describeTiming(event({ startMinute: 615, minutes: 90 })), "10:15, 1 h 30 min");
  assertEquals(describeTiming(event({ minutes: 0 })), "09:00, 0 min");
  assertEquals(describeTiming(event({ allDay: true })), "all day");
  assertEquals(describeTiming(event({ allDay: true, days: 3 })), "all day, 3 days");
});

Deno.test("the message names events by ref, in the language asked for, without emails", () => {
  const message = buildLabelMessage(
    [event(), event({ title: "Fredagsbar", calendar: "mia@example.com", count: 12 })],
    "da",
  );
  assertStringIncludes(message, "Write each reason in Danish.");
  assertStringIncludes(
    message,
    '{"ref":"e1","title":"Eksamen statistik","calendar":"Uni","when":"09:00, 4 h","occurs":1}',
  );
  assertStringIncludes(message, '"ref":"e2"');
  assertStringIncludes(message, '"occurs":12');
  assertEquals(message.includes("example.com"), false);
  assertStringIncludes(buildLabelMessage([event()], "en"), "Write each reason in English.");
});

Deno.test("the correction message carries the old label and the note as data", () => {
  const message = buildRelabelMessage(event(), label(), 'Det er en "prøveeksamen"', "da");
  assertStringIncludes(message, '"ref":"e1"');
  assertStringIncludes(message, '"kind":"exam"');
  assertStringIncludes(message, '"Det er en \\"prøveeksamen\\""');
});

Deno.test("readEvent cleans the request and keeps numbers in range", () => {
  assertEquals(readEvent({ title: "  " }), null);
  assertEquals(readEvent("Eksamen"), null);
  assertEquals(readEvent({ title: "Vagt", startMinute: 5000, minutes: -3, count: 0 }), {
    title: "Vagt",
    calendar: "",
    allDay: false,
    startMinute: 1439,
    minutes: 0,
    days: 1,
    count: 1,
  });
  // All day: no start or length, only days.
  assertEquals(readEvent({ title: "Ferie", allDay: true, startMinute: 600, days: 400 }), {
    title: "Ferie",
    calendar: "",
    allDay: true,
    startMinute: 0,
    minutes: 0,
    days: 60,
    count: 1,
  });
});

Deno.test("readEvents takes 1 to MAX_EVENTS events, all with titles", () => {
  assertEquals(readEvents([]), null);
  assertEquals(readEvents("x"), null);
  assertEquals(readEvents([{ title: "A" }, { title: "" }]), null);
  assertEquals(readEvents([{ title: "A" }])?.length, 1);
  assertEquals(readEvents(Array.from({ length: MAX_EVENTS + 1 }, () => ({ title: "A" }))), null);
});

Deno.test("cleanLabel snaps every field into its limits", () => {
  assertEquals(cleanLabel(null), null);
  assertEquals(cleanLabel({ kind: "illness" }), null);
  assertEquals(
    cleanLabel({
      kind: "exam",
      importance: "extreme",
      prepDays: 99,
      avoidBefore: ["alcohol", "drugs", "alcohol", "lateNight"],
      recoveryDays: -1,
      strain: 3,
      confidence: "sure",
      reason: "x".repeat(500),
      extra: "dropped",
    }),
    {
      kind: "exam",
      importance: "normal",
      prepDays: MAX_PREP_DAYS,
      avoidBefore: ["lateNight", "alcohol"],
      recoveryDays: 0,
      strain: "light",
      confidence: "low",
      reason: "x".repeat(140),
    },
  );
  // Unclear is never more than a guess.
  assertEquals(cleanLabel(label({ kind: "unclear", confidence: "high" }))?.confidence, "low");
});

Deno.test("labelsFromAnswer maps refs back in order and drops the rest", () => {
  const answer = JSON.stringify({
    labels: [
      { ref: "e2", ...label({ kind: "party" }) },
      { ref: "e1", ...label() },
      { ref: "e3", ...label({ kind: "medical" as never }) },
      { ref: "e4", ...label() },
      { ref: "e4", ...label({ kind: "work" }) },
      { ref: "e9", ...label() },
      { ref: "x", ...label() },
    ],
  });
  const labels = labelsFromAnswer("end_turn", answer, 5);
  assert(labels);
  assertEquals(labels.length, 5);
  assertEquals(labels[0]?.kind, "exam");
  assertEquals(labels[1]?.kind, "party");
  // Unknown kind, answered twice, and not answered.
  assertEquals(labels.slice(2), [null, null, null]);
  assertEquals(labelsFromAnswer("max_tokens", answer, 5), null);
  assertEquals(labelsFromAnswer("end_turn", "not json", 5), null);
  assertEquals(labelsFromAnswer("end_turn", "{}", 5), null);
});

Deno.test("the schema has no nullable fields (structured outputs limit them)", () => {
  assertEquals(JSON.stringify(LABEL_SCHEMA).includes("null"), false);
});
