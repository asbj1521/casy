import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildIdeasMessage,
  describeStretch,
  ideasFromAnswer,
  MAX_IDEA_TITLE,
  MAX_IDEAS,
  readIdeasRequest,
  type StretchToFill,
} from "./ideasAi.ts";

const stretch = (over: Partial<StretchToFill> = {}): StretchToFill => ({
  kind: "hours",
  startMinute: 14 * 60,
  minutes: 8 * 60,
  weekday: 6,
  month: 9,
  groupSize: 3,
  about: "",
  ...over,
});

Deno.test("describeStretch says the day, the hours and the length, or a weekend", () => {
  assertEquals(describeStretch(stretch()), "Saturday from 14:00 to 22:00 (8 h)");
  assertEquals(
    describeStretch(stretch({ weekday: 2, startMinute: 1050, minutes: 270 })),
    "Tuesday from 17:30 to 22:00 (4.5 h)",
  );
  assertEquals(
    describeStretch(stretch({ kind: "weekend" })),
    "a whole weekend, Saturday and Sunday",
  );
});

Deno.test(
  "the message carries the time, month, size and what the group is for, nothing more",
  () => {
    assertEquals(
      buildIdeasMessage(stretch(), "da"),
      'Write in Danish.\n\nThe free time:\n{"when":"Saturday from 14:00 to 22:00 (8 h)","month":"October","people":3}',
    );
    assertStringIncludes(
      buildIdeasMessage(stretch({ about: "Vi løber om tirsdagen" }), "en"),
      '"groupIsFor":"Vi løber om tirsdagen"',
    );
  },
);

Deno.test("readIdeasRequest takes a stretch in range and refuses anything else", () => {
  assertEquals(readIdeasRequest({ ...stretch(), about: "  Løb\n " }), stretch({ about: "Løb" }));
  assertEquals(readIdeasRequest({ ...stretch(), about: undefined }), stretch());
  assertEquals(readIdeasRequest({ ...stretch(), kind: "trip" }), null);
  assertEquals(readIdeasRequest({ ...stretch(), weekday: 7 }), null);
  assertEquals(readIdeasRequest({ ...stretch(), month: 12 }), null);
  assertEquals(readIdeasRequest({ ...stretch(), groupSize: 1 }), null);
  assertEquals(readIdeasRequest({ ...stretch(), minutes: 10 }), null);
  assertEquals(readIdeasRequest([]), null);
});

Deno.test("ideasFromAnswer cleans the ideas: no dashes, no full stop, cut to their limits", () => {
  const answer = JSON.stringify({
    ideas: [
      { title: "Brunch – og gåtur.", why: "Hele dagen fri — perfekt til at gå 10–12 km" },
      { title: "x".repeat(60), why: "Lang" },
      { title: "", why: "No title" },
      { title: "Brætspil", why: "En rolig aften" },
      { title: "Fourth", why: "One too many" },
    ],
  });
  const ideas = ideasFromAnswer("end_turn", answer)!;
  assertEquals(ideas.length, MAX_IDEAS);
  assertEquals(ideas[0], {
    title: "Brunch, og gåtur",
    why: "Hele dagen fri, perfekt til at gå 10-12 km",
  });
  assertEquals(ideas[1].title.length, MAX_IDEA_TITLE);
  assertEquals(ideas[2].title, "Brætspil");
});

Deno.test("ideasFromAnswer is null for a cut-off, broken or empty answer", () => {
  assertEquals(ideasFromAnswer("max_tokens", '{"ideas":[]}'), null);
  assertEquals(ideasFromAnswer("end_turn", "{"), null);
  assertEquals(ideasFromAnswer("end_turn", '{"ideas":[]}'), null);
  assertEquals(ideasFromAnswer("end_turn", '{"ideas":"no"}'), null);
});
