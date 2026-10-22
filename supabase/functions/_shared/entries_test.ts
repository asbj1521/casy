import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildEntriesMessage,
  type CasyEntry,
  cleanEntries,
  ENTRIES_SCHEMA,
  entriesFromAnswer,
  MAX_ENTRIES_PER_CALL,
  readEntries,
  readEntriesRequest,
  readEntry,
  toWire,
} from "./entries.ts";

/** 9 October 2026, noon in Copenhagen (summer time, UTC+2). */
const NOW = Date.parse("2026-10-09T10:00:00Z");

/** An entry as the model writes it: whole days unless times are given. */
function wire(fields: Record<string, unknown> = {}) {
  return {
    kind: "away",
    label: "Rejse",
    startDate: "2026-10-12",
    startTime: "",
    endDate: "2026-10-19",
    endTime: "",
    ...fields,
  };
}

Deno.test("the schema has no nullable or union fields and every object is closed", () => {
  assert(!JSON.stringify(ENTRIES_SCHEMA).includes("anyOf"));
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object") {
      assertEquals(n.additionalProperties, false);
      assertEquals(
        [...(n.required as string[])].sort(),
        Object.keys(n.properties as object).sort(),
      );
    }
    Object.values(n).forEach(walk);
  };
  walk(ENTRIES_SCHEMA);
});

Deno.test("whole days run from the first Danish midnight to the one after the last day", () => {
  const { entries } = cleanEntries({ entries: [wire()], message: "" }, NOW);
  assertEquals(entries, [
    {
      kind: "away",
      label: "Rejse",
      start: "2026-10-11T22:00:00.000Z", // 12 Oct 00:00, summer time
      end: "2026-10-19T22:00:00.000Z", // 20 Oct 00:00
      allDay: true,
    },
  ]);
});

Deno.test("winter time is worked out too: all of December", () => {
  const { entries } = cleanEntries(
    { entries: [wire({ label: "Hjemme", startDate: "2026-12-01", endDate: "2026-12-31" })] },
    NOW,
  );
  assertEquals(entries[0].start, "2026-11-30T23:00:00.000Z");
  assertEquals(entries[0].end, "2026-12-31T23:00:00.000Z");
});

Deno.test("a stretch over the clocks going back keeps its whole days", () => {
  // 25 October 2026 is 25 hours long.
  const { entries } = cleanEntries(
    { entries: [wire({ startDate: "2026-10-24", endDate: "2026-10-26" })] },
    NOW,
  );
  assertEquals(entries[0].start, "2026-10-23T22:00:00.000Z");
  assertEquals(entries[0].end, "2026-10-26T23:00:00.000Z");
});

Deno.test("an empty end date is a single day", () => {
  const { entries } = cleanEntries({ entries: [wire({ endDate: "" })] }, NOW);
  assertEquals(entries[0].start, "2026-10-11T22:00:00.000Z");
  assertEquals(entries[0].end, "2026-10-12T22:00:00.000Z");
});

Deno.test("set hours are read in Danish time", () => {
  const { entries } = cleanEntries(
    {
      entries: [
        wire({
          kind: "busy",
          label: "Kursus",
          startDate: "2026-10-15",
          startTime: "18:00",
          endDate: "",
          endTime: "22:00",
        }),
      ],
    },
    NOW,
  );
  assertEquals(entries[0].start, "2026-10-15T16:00:00.000Z");
  assertEquals(entries[0].end, "2026-10-15T20:00:00.000Z");
  assertEquals(entries[0].allDay, false);
});

Deno.test("an end earlier than the start with no end date ends the next day", () => {
  const { entries } = cleanEntries(
    {
      entries: [
        wire({
          kind: "busy",
          startDate: "2026-10-16",
          startTime: "22:00",
          endDate: "",
          endTime: "02:00",
        }),
      ],
    },
    NOW,
  );
  assertEquals(entries[0].start, "2026-10-16T20:00:00.000Z");
  assertEquals(entries[0].end, "2026-10-17T00:00:00.000Z");
});

Deno.test(
  "junk in both time fields is read as whole days; a real time with junk is dropped",
  () => {
    const { entries } = cleanEntries(
      {
        entries: [
          wire({ startTime: "", endTime: "','" }), // seen from the model: no times at all
          wire({ startTime: "later", endTime: "" }),
          wire({ startTime: "18:00", endTime: "','" }), // a start with no end: unclear
        ],
      },
      NOW,
    );
    assertEquals(entries.length, 2);
    assert(entries.every((e) => e.allDay));
  },
);

Deno.test("an entry with only one time is dropped rather than guessed", () => {
  const { entries } = cleanEntries(
    {
      entries: [
        wire({ startTime: "18:00", endTime: "" }),
        wire({ startTime: "", endTime: "18:00" }),
      ],
    },
    NOW,
  );
  assertEquals(entries, []);
});

Deno.test(
  "what isn't worth keeping is dropped: the past, impossible dates, too long, too far",
  () => {
    const { entries } = cleanEntries(
      {
        entries: [
          wire({ startDate: "2026-09-01", endDate: "2026-09-05" }), // over
          wire({ startDate: "2026-02-30", endDate: "" }), // no such day
          wire({ startDate: "2026-10-12", endDate: "2027-03-01" }), // over 120 days
          wire({ startDate: "2028-01-10", endDate: "" }), // beyond the months searched
          wire({ startDate: "12 October", endDate: "" }), // not a date
          wire({ kind: "free" }), // not a kind
          wire({ label: "  " }), // nothing to call it
          wire({ label: "Ok", startDate: "2026-10-12", endDate: "2026-10-12" }),
        ],
      },
      NOW,
    );
    assertEquals(
      entries.map((e) => e.label),
      ["Ok"],
    );
  },
);

Deno.test("one that has started but not ended still counts", () => {
  const { entries } = cleanEntries(
    { entries: [wire({ startDate: "2026-10-05", endDate: "2026-10-12" })] },
    NOW,
  );
  assertEquals(entries.length, 1);
});

Deno.test("labels are plain text without dashes, and entries come out soonest first", () => {
  const { entries } = cleanEntries(
    {
      entries: [
        wire({ label: "Senere", startDate: "2026-11-02", endDate: "" }),
        wire({ label: "Rom – tur 12–19\n", startDate: "2026-10-12", endDate: "" }),
      ],
      message: "Hvilken måned — mener du?",
    },
    NOW,
  );
  assertEquals(
    entries.map((e) => e.label),
    ["Rom, tur 12-19", "Senere"],
  );
});

Deno.test("a message is cleaned like a label, and none is null", () => {
  assertEquals(cleanEntries({ entries: [], message: "Hvilken måned — mener du?" }, NOW), {
    entries: [],
    message: "Hvilken måned, mener du?",
  });
  assertEquals(cleanEntries({ entries: [], message: "" }, NOW).message, null);
});

Deno.test("an answer holds at most one call's worth of entries", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    wire({ label: `Dag ${i}`, startDate: "2026-11-02", endDate: "" }),
  );
  assertEquals(cleanEntries({ entries: many }, NOW).entries.length, MAX_ENTRIES_PER_CALL);
});

Deno.test("anything that isn't the answer's shape comes out empty", () => {
  assertEquals(cleanEntries(null, NOW), { entries: [], message: null });
  assertEquals(cleanEntries({ entries: "x", message: 3 }, NOW), { entries: [], message: null });
  assertEquals(cleanEntries({ entries: [null, 1, []] }, NOW).entries, []);
});

Deno.test("entriesFromAnswer: a usable answer, or null", () => {
  const ok = JSON.stringify({ entries: [wire()], message: "" });
  assertEquals(entriesFromAnswer("end_turn", ok, NOW)?.entries.length, 1);
  assertEquals(entriesFromAnswer("max_tokens", ok, NOW), null); // cut off
  assertEquals(entriesFromAnswer("refusal", ok, NOW), null);
  assertEquals(entriesFromAnswer("end_turn", "not json", NOW), null);
  assertEquals(entriesFromAnswer("end_turn", undefined, NOW), null);
  // Nothing to keep and nothing to say: not an answer.
  assertEquals(
    entriesFromAnswer("end_turn", JSON.stringify({ entries: [], message: "" }), NOW),
    null,
  );
  // A question alone is one.
  assertEquals(
    entriesFromAnswer("end_turn", JSON.stringify({ entries: [], message: "Hvilken måned?" }), NOW),
    { entries: [], message: "Hvilken måned?" },
  );
});

const SAVED: CasyEntry = {
  kind: "away",
  label: "Rejse",
  start: "2026-10-11T22:00:00.000Z",
  end: "2026-10-19T22:00:00.000Z",
  allDay: true,
};

Deno.test("readEntry keeps a valid entry and allDay only for Danish midnights", () => {
  assertEquals(readEntry(SAVED, NOW), SAVED);
  assertEquals(readEntry({ ...SAVED, start: "2026-10-11T21:00:00.000Z" }, NOW)?.allDay, false);
  assertEquals(readEntry({ ...SAVED, allDay: "yes" }, NOW)?.allDay, false);
});

Deno.test("readEntry refuses what the app would never send", () => {
  for (const bad of [
    null,
    "x",
    [],
    { ...SAVED, kind: "free" },
    { ...SAVED, label: "" },
    { ...SAVED, label: 5 },
    { ...SAVED, start: "soon" },
    { ...SAVED, end: SAVED.start }, // no length
    { ...SAVED, end: "2026-10-01T00:00:00.000Z" }, // end before start
    { ...SAVED, start: "2026-08-01T00:00:00.000Z", end: "2026-08-02T00:00:00.000Z" }, // over
    { ...SAVED, start: "2029-01-01T00:00:00.000Z", end: "2029-01-02T00:00:00.000Z" }, // far off
    { ...SAVED, start: "2026-10-12T00:00:00.000Z", end: "2027-06-01T00:00:00.000Z" }, // too long
  ]) {
    assertEquals(readEntry(bad, NOW), null, JSON.stringify(bad));
  }
});

Deno.test("readEntries is all or nothing, and bounded", () => {
  assertEquals(readEntries([SAVED, SAVED], NOW)?.length, 2);
  assertEquals(readEntries([SAVED, { ...SAVED, kind: "x" }], NOW), null);
  assertEquals(readEntries([], NOW), null);
  assertEquals(readEntries("x", NOW), null);
  assertEquals(readEntries(Array(MAX_ENTRIES_PER_CALL + 1).fill(SAVED), NOW), null);
});

Deno.test(
  "toWire writes an entry the way people say it, and reading it back gives the same entry",
  () => {
    const timed: CasyEntry = {
      kind: "busy",
      label: "Kursus",
      start: "2026-10-15T16:00:00.000Z",
      end: "2026-10-15T20:00:00.000Z",
      allDay: false,
    };
    assertEquals(toWire(SAVED), {
      kind: "away",
      label: "Rejse",
      startDate: "2026-10-12",
      startTime: "",
      endDate: "2026-10-19",
      endTime: "",
    });
    assertEquals(toWire(timed), {
      kind: "busy",
      label: "Kursus",
      startDate: "2026-10-15",
      startTime: "18:00",
      endDate: "",
      endTime: "22:00",
    });
    assertEquals(cleanEntries({ entries: [SAVED, timed].map(toWire) }, NOW).entries, [
      SAVED,
      timed,
    ]);
  },
);

Deno.test("the message names today, the language and the entries so far", () => {
  const first = buildEntriesMessage({ text: "Jeg rejser", earlier: [], current: null }, "da", NOW);
  assertStringIncludes(first, "Friday, 9 October 2026");
  assertStringIncludes(first, "Danish");
  assertStringIncludes(first, "<description>Jeg rejser</description>");
  assert(!first.includes("The entries so far"));

  const next = buildEntriesMessage(
    { text: "til den 21.", earlier: ["Jeg rejser"], current: [SAVED] },
    "en",
    NOW,
  );
  assertStringIncludes(next, "English");
  assertStringIncludes(next, "The entries so far: ");
  assertStringIncludes(next, '"endDate":"2026-10-19"');
  assertStringIncludes(next, "Written earlier: <description>Jeg rejser</description>");
});

Deno.test("readEntriesRequest: text required, bounded, earlier and current checked", () => {
  assertEquals(readEntriesRequest({ text: "  " }, NOW), null);
  assertEquals(readEntriesRequest({}, NOW), null);
  assertEquals(readEntriesRequest({ text: "x".repeat(2000) }, NOW), null);
  assertEquals(readEntriesRequest({ text: "hej", earlier: ["a", "b", "c", "d", "e"] }, NOW), null);
  assertEquals(readEntriesRequest({ text: "hej", earlier: [3] }, NOW), null);
  assertEquals(readEntriesRequest({ text: "hej", current: [{ kind: "x" }] }, NOW), null);
  assertEquals(readEntriesRequest({ text: "hej", current: "x" }, NOW), null);
  assertEquals(readEntriesRequest({ text: " hej\u0000 " }, NOW), {
    text: "hej",
    earlier: [],
    current: null,
  });
  assertEquals(readEntriesRequest({ text: "hej", current: [SAVED] }, NOW)?.current, [SAVED]);
  assertEquals(readEntriesRequest({ text: "hej", current: [] }, NOW)?.current, null);
});
