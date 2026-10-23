import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildLegsMessage,
  cleanLeg,
  HOME,
  legsFromAnswer,
  LEGS_SCHEMA,
  MAX_EVENTS,
  readEvent,
  readEvents,
} from "./tripLegs.ts";

const event = { title: "Fly til Oslo", location: "Københavns Lufthavn", calendar: "Privat" };

Deno.test("readEvent keeps what is sent and nothing else", () => {
  assertEquals(readEvent({ ...event, allDay: true, notes: "gate 12", start: 1 }), {
    ...event,
    allDay: true,
  });
  assertEquals(readEvent({ title: "Tog", location: 5 }), {
    title: "Tog",
    location: "",
    calendar: "",
    allDay: false,
  });
  assertEquals(readEvent({ title: "  " }), null);
  assertEquals(readEvent("Fly"), null);
});

Deno.test("readEvents takes 1 to MAX_EVENTS events, all with titles", () => {
  assertEquals(readEvents([]), null);
  assertEquals(readEvents([event, { title: "" }]), null);
  assertEquals(readEvents(Array.from({ length: MAX_EVENTS + 1 }, () => event)), null);
  assertEquals(readEvents([event])?.length, 1);
});

Deno.test("the message names events by ref, without emails in calendar names", () => {
  const message = buildLegsMessage([
    { ...event, allDay: false },
    { title: "Tog hjem", location: "", calendar: "me@example.com", allDay: false },
  ]);
  assertStringIncludes(message, '"ref":"e1"');
  assertStringIncludes(message, '"place":"Københavns Lufthavn"');
  assertStringIncludes(message, '"ref":"e2"');
  assert(!message.includes("me@example.com"));
});

Deno.test("cleanLeg snaps an answer into its limits", () => {
  assertEquals(cleanLeg({ mode: "flight", from: "Copenhagen", to: "Oslo", confidence: "high" }), {
    mode: "flight",
    from: "Copenhagen",
    to: "Oslo",
    confidence: "high",
  });
  // Home in any case, a ferry's cities dropped, junk cities emptied, an unknown confidence low.
  assertEquals(cleanLeg({ mode: "train", from: "Aarhus", to: "home", confidence: "sure" }), {
    mode: "train",
    from: "Aarhus",
    to: HOME,
    confidence: "low",
  });
  assertEquals(cleanLeg({ mode: "none", from: "Oslo", to: "Bergen", confidence: "high" }), {
    mode: "none",
    from: "",
    to: "",
    confidence: "high",
  });
  const junk = cleanLeg({
    mode: "bus",
    from: "SK1467",
    to: "the city where the bus goes",
    confidence: "medium",
  });
  assertEquals([junk?.from, junk?.to], ["", ""]);
  assertEquals(cleanLeg({ mode: "ferry", from: "", to: "", confidence: "high" }), null);
});

Deno.test("cleanLeg treats a journey that goes nowhere as none", () => {
  assertEquals(cleanLeg({ mode: "flight", from: "Oslo", to: "oslo", confidence: "high" }), {
    mode: "none",
    from: "",
    to: "",
    confidence: "low",
  });
});

Deno.test("legsFromAnswer reads one leg per event, by ref", () => {
  const text = JSON.stringify({
    legs: [
      { ref: "e2", mode: "train", from: "Oslo", to: "HOME", confidence: "medium" },
      { ref: "e1", mode: "flight", from: "Copenhagen", to: "Oslo", confidence: "high" },
      { ref: "e9", mode: "flight", from: "A", to: "B", confidence: "high" },
    ],
  });
  assertEquals(legsFromAnswer("end_turn", text, 3), [
    { mode: "flight", from: "Copenhagen", to: "Oslo", confidence: "high" },
    { mode: "train", from: "Oslo", to: HOME, confidence: "medium" },
    null,
  ]);
});

Deno.test("legsFromAnswer drops an event answered twice, and unreadable answers", () => {
  const twice = JSON.stringify({
    legs: [
      { ref: "e1", mode: "flight", from: "A", to: "B", confidence: "high" },
      { ref: "e1", mode: "bus", from: "B", to: "A", confidence: "high" },
    ],
  });
  assertEquals(legsFromAnswer("end_turn", twice, 1), [null]);
  assertEquals(legsFromAnswer("max_tokens", twice, 1), null);
  assertEquals(legsFromAnswer("end_turn", "not json", 1), null);
  assertEquals(legsFromAnswer("end_turn", "{}", 1), null);
});

Deno.test("the schema asks for every field and nothing else", () => {
  const item = (LEGS_SCHEMA.properties.legs as { items: { required: string[] } }).items;
  assertEquals(item.required, ["ref", "mode", "from", "to", "confidence"]);
});
