import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import { BLOCKED_TEXT, hasBlockedWords, refuseBlockedWords } from "./contentFilter.ts";
import { HttpError } from "./http.ts";

Deno.test("blocked words are found, however they are written", () => {
  for (const text of ["Whore", "din LUDER!", "n1gger", "fest, porno og øl", "Kill yourself."]) {
    assertEquals(hasBlockedWords(text), true, text);
  }
});

Deno.test("everyday words pass, in both languages", () => {
  for (const text of [
    "Middag hos Sara",
    "Kys og kram",
    "Fag og frokost",
    "Scunthorpe tur",
    "Spicy food",
    "Fredagsbar",
    "Kill Bill i biografen",
    "Hoteller i Rom",
  ]) {
    assertEquals(hasBlockedWords(text), false, text);
  }
});

Deno.test("refusing says why, and empty texts pass", () => {
  refuseBlockedWords(null, undefined, "", "Middag");
  const err = assertThrows(() => refuseBlockedWords("Middag", "din luder"), HttpError);
  assertEquals([err.status, err.message], [400, BLOCKED_TEXT]);
});
