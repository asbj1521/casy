import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildCategorizeMessage,
  categoriesFromAnswer,
  CATEGORIZE_SCHEMA,
  MAX_TITLES,
  readTitles,
  safeName,
} from "./categorizeAi.ts";

Deno.test("safeName takes out email addresses and links", () => {
  assertEquals(safeName("mia@example.com"), "(the account's main calendar)");
  assertEquals(safeName("Skema https://example.com/feed?token=secret"), "Skema (link)");
  assertEquals(safeName("  DTU  "), "DTU");
  assertEquals(safeName(""), "(no name)");
});

Deno.test("the message names calendars by ref, with titles only where given", () => {
  const message = buildCategorizeMessage([
    { id: "uuid-1", name: "Arbejde", provider: "icloud", titles: [] },
    { id: "uuid-2", name: "mia@example.com", provider: "google", titles: ["Statistik"] },
  ]);
  assertStringIncludes(message, '{"ref":"c1","name":"Arbejde","account":"Apple Calendar"}');
  assertStringIncludes(
    message,
    '{"ref":"c2","name":"(the account\'s main calendar)","account":"Google Calendar","sampleTitles":["Statistik"]}',
  );
  assertEquals(message.includes("uuid-"), false);
  assertEquals(message.includes("example.com"), false);
});

Deno.test("readTitles keeps only allowed calendars, cleaned and capped", () => {
  const titles = readTitles(
    {
      allowed: ["  Vagt ", "Vagt", "", 42, ...Array.from({ length: 30 }, (_, i) => `T${i}`)],
      other: ["Secret"],
      bad: "not a list",
    },
    new Set(["allowed", "bad"]),
  );
  assertEquals([...titles.keys()], ["allowed"]);
  assertEquals(titles.get("allowed")!.length, MAX_TITLES);
  assertEquals(titles.get("allowed")!.slice(0, 2), ["Vagt", "T0"]);
  assertEquals(readTitles(["a list"], new Set(["0"])).size, 0);
  assertEquals(readTitles(undefined, new Set(["x"])).size, 0);
});

Deno.test("categoriesFromAnswer maps refs back, unsure to null, and drops the rest", () => {
  const ids = ["a", "b", "c", "d"];
  const answer = JSON.stringify({
    calendars: [
      { ref: "c1", category: "work" },
      { ref: "c2", category: "unsure" },
      { ref: "c3", category: "holiday" },
      { ref: "c4", category: "school" },
      { ref: "c4", category: "personal" },
      { ref: "c9", category: "other" },
      { ref: "x", category: "other" },
    ],
  });
  const categories = categoriesFromAnswer("end_turn", answer, ids)!;
  assertEquals(
    [...categories],
    [
      ["a", "work"],
      ["b", null],
    ],
  );
});

Deno.test("categoriesFromAnswer gives up on an answer it can't read", () => {
  assertEquals(categoriesFromAnswer("max_tokens", "{}", ["a"]), null);
  assertEquals(categoriesFromAnswer("end_turn", undefined, ["a"]), null);
  assertEquals(categoriesFromAnswer("end_turn", "not json", ["a"]), null);
  assertEquals(categoriesFromAnswer("end_turn", '{"calendars":"x"}', ["a"]), null);
});

Deno.test("the schema allows only the four categories and unsure", () => {
  const items = (
    CATEGORIZE_SCHEMA.properties.calendars as {
      items: { properties: { category: { enum: string[] } } };
    }
  ).items;
  assertEquals(items.properties.category.enum, ["work", "school", "personal", "other", "unsure"]);
});
