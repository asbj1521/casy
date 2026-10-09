import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import {
  buildPlanMessage,
  cleanPlan,
  PLAN_SCHEMA,
  planFromAnswer,
  readPlanRequest,
  searchMonths,
  toWire,
  withoutDashes,
} from "./planAi.ts";

/** 9 October 2026, noon in Copenhagen. */
const NOW = Date.parse("2026-10-09T10:00:00Z");
const MONTHS = searchMonths(NOW).map((m) => m.key);

/** An answer as the model writes it: everything empty but `fields`. */
function wire(fields: Record<string, unknown> = {}) {
  return {
    kind: "",
    start: "",
    durationMinutes: 0,
    weekdays: [],
    days: 0,
    startWeekday: -1,
    monthsFrom: "",
    monthsTo: "",
    title: "",
    place: "",
    note: "",
    people: { without: [], optional: [], required: [] },
    atLeast: 0,
    assumed: [],
    questions: [],
    ...fields,
  };
}

const EMPTY_SETTINGS = {
  kind: null,
  startHour: null,
  anyTime: null,
  durationMinutes: null,
  weekdays: null,
  days: null,
  startWeekday: null,
  months: null,
};

Deno.test("the schema has no nullable or union fields (the API compiles at most 16)", () => {
  assert(!JSON.stringify(PLAN_SCHEMA).includes("anyOf"));
  assert(!JSON.stringify(PLAN_SCHEMA).includes('"null"'));
});

Deno.test("every object in the schema is closed with all its fields required", () => {
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object") {
      assertEquals(n.additionalProperties, false);
      assertEquals(n.required, Object.keys(n.properties as object));
    }
    Object.values(n).forEach(walk);
  };
  walk(PLAN_SCHEMA);
});

Deno.test("the months searched are this one and the next eleven, in Danish time", () => {
  assertEquals(MONTHS.length, 12);
  assertEquals(MONTHS[0], "2026-10");
  assertEquals(MONTHS[11], "2027-09");
  // 23:30 UTC on New Year's Eve is already January in Copenhagen.
  assertEquals(searchMonths(Date.parse("2026-12-31T23:30:00Z"))[0].key, "2027-01");
});

Deno.test("an empty answer is all nulls, and a full one is read field by field", () => {
  const empty = cleanPlan(wire(), MONTHS);
  assertEquals(
    { ...empty, title: empty.title },
    {
      ...EMPTY_SETTINGS,
      title: null,
      place: null,
      note: null,
      people: { without: [], optional: [], required: [] },
      atLeast: null,
      assumed: [],
      questions: [],
    },
  );

  const plan = cleanPlan(
    wire({
      kind: "meeting",
      start: "18",
      durationMinutes: 180,
      weekdays: [5],
      monthsFrom: "2026-11",
      monthsTo: "2026-11",
      title: "Middag",
      people: { without: ["Peter"], optional: [], required: [] },
      atLeast: 4,
      assumed: ["start", "durationMinutes"],
    }),
    MONTHS,
  );
  assertEquals(plan.kind, "meeting");
  assertEquals([plan.startHour, plan.anyTime], [18, false]);
  assertEquals(plan.durationMinutes, 180);
  assertEquals(plan.weekdays, [5]);
  assertEquals(plan.months, { from: "2026-11", to: "2026-11" });
  assertEquals(plan.title, "Middag");
  assertEquals(plan.people.without, ["Peter"]);
  assertEquals(plan.atLeast, 4);
  assertEquals(plan.assumed, ["startHour", "durationMinutes"]);
});

Deno.test("start reads an hour, an hour with minutes, or any time", () => {
  const start = (s: string) => {
    const p = cleanPlan(wire({ start: s }), MONTHS);
    return [p.startHour, p.anyTime];
  };
  assertEquals(start("19"), [19, false]);
  assertEquals(start("19:30"), [19, false]);
  assertEquals(start("any"), [null, true]);
  assertEquals(start("24"), [null, false]);
  assertEquals(start("evening"), [null, null]);
});

Deno.test("numbers are snapped into the scheduler's limits", () => {
  const p = (fields: Record<string, unknown>) => cleanPlan(wire(fields), MONTHS);
  assertEquals(p({ durationMinutes: 100 }).durationMinutes, 90);
  assertEquals(p({ durationMinutes: 5 }).durationMinutes, 30);
  assertEquals(p({ durationMinutes: 2000 }).durationMinutes, 720);
  assertEquals(p({ kind: "trip", days: 12 }).days, 7);
  assertEquals(p({ kind: "holiday", days: 45 }).days, 30);
  assertEquals(p({ weekdays: [6, 0, 6, 9, -1, 2.5] }).weekdays, [0, 6]);
  assertEquals(p({ startWeekday: 7 }).startWeekday, null);
  assertEquals(p({ atLeast: 50 }).atLeast, null);
});

Deno.test("months are pulled into the year searched, or dropped when wholly outside", () => {
  const months = (from: string, to: string) =>
    cleanPlan(wire({ monthsFrom: from, monthsTo: to }), MONTHS).months;
  assertEquals(months("2026-12", "2026-12"), { from: "2026-12", to: "2026-12" });
  assertEquals(months("2027-02", "2026-12"), { from: "2026-12", to: "2027-02" });
  assertEquals(months("2026-08", "2026-11"), { from: "2026-10", to: "2026-11" });
  assertEquals(months("2027-08", "2028-02"), { from: "2027-08", to: "2027-09" });
  assertEquals(months("2025-01", "2025-03"), null);
  assertEquals(months("2026-12", ""), { from: "2026-12", to: "2026-12" });
  assertEquals(months("December", ""), null);
  assertEquals(months("any", ""), "any");
});

Deno.test("text is capped and loses its dashes", () => {
  assertEquals(withoutDashes("18–20"), "18-20");
  assertEquals(withoutDashes("Middag — hos Peter"), "Middag, hos Peter");
  const plan = cleanPlan(wire({ title: "x".repeat(80), place: "  Skagen  " }), MONTHS);
  assertEquals(plan.title, "x".repeat(60));
  assertEquals(plan.place, "Skagen");
});

Deno.test("names are kept as written, trimmed and without repeats", () => {
  const plan = cleanPlan(
    wire({ people: { without: [" Peter ", "Peter", "", 4], optional: ["Anna"], required: [] } }),
    MONTHS,
  );
  assertEquals(plan.people, { without: ["Peter"], optional: ["Anna"], required: [] });
});

Deno.test("questions keep options that change something, at most 3 questions of 4 options", () => {
  const option = (label: string, patch: Record<string, unknown>) => ({
    label,
    patch: { ...wire(), ...patch },
  });
  const plan = cleanPlan(
    wire({
      questions: [
        {
          question: "Én aften eller en tur?",
          options: [
            option("En aften", { kind: "meeting", start: "18" }),
            option("En tur", { kind: "trip", days: 2, startWeekday: 5 }),
            option("Ingenting", {}),
          ],
        },
        // One usable option is no choice: the whole question goes.
        { question: "Hvornår?", options: [option("Om aftenen", { start: "18" }), option("", {})] },
        ...Array.from({ length: 4 }, (_, i) => ({
          question: `Spørgsmål ${i}`,
          options: [option("A", { days: 2 }), option("B", { days: 3 })],
        })),
      ],
    }),
    MONTHS,
  );
  assertEquals(plan.questions.length, 3);
  assertEquals(
    plan.questions[0].options.map((o) => o.label),
    ["En aften", "En tur"],
  );
  assertEquals(plan.questions[0].options[1].patch, {
    ...EMPTY_SETTINGS,
    kind: "trip",
    days: 2,
    startWeekday: 5,
  });
  assertEquals(plan.questions[1].question, "Spørgsmål 0");
});

Deno.test("an answer is only used when finished, JSON, and about an event", () => {
  const text = JSON.stringify(wire({ kind: "meeting" }));
  assertEquals(planFromAnswer("end_turn", text, NOW)?.kind, "meeting");
  assertEquals(planFromAnswer("refusal", text, NOW), null);
  assertEquals(planFromAnswer("max_tokens", text, NOW), null);
  assertEquals(planFromAnswer("end_turn", "not json", NOW), null);
  assertEquals(planFromAnswer("end_turn", undefined, NOW), null);
  assertEquals(planFromAnswer("end_turn", JSON.stringify(wire()), NOW), null);
  // Only people, when adding details, is still a plan.
  const people = JSON.stringify(
    wire({ people: { without: [], optional: ["Anna"], required: [] } }),
  );
  assertEquals(planFromAnswer("end_turn", people, NOW)?.people.optional, ["Anna"]);
});

Deno.test(
  "a request needs a description; earlier ones and the settings so far are optional",
  () => {
    assertEquals(readPlanRequest({ text: "  Middag  " }), {
      text: "Middag",
      earlier: [],
      current: null,
    });
    assertEquals(readPlanRequest({}), null);
    assertEquals(readPlanRequest({ text: "   " }), null);
    assertEquals(readPlanRequest({ text: "x".repeat(1001) }), null);
    assertEquals(readPlanRequest({ text: "x".repeat(600) })?.text.length, 500);
    assertEquals(readPlanRequest({ text: "a\nb\u0000c" })?.text, "a\nbc");
    assertEquals(readPlanRequest({ text: "a", earlier: ["b", "c", "d", "e", "f"] }), null);
    assertEquals(readPlanRequest({ text: "a", earlier: ["b", 4] }), null);
    assertEquals(readPlanRequest({ text: "a", current: "x" }), null);
    const current = { ...EMPTY_SETTINGS, kind: "meeting", startHour: 18, months: "any", extra: 1 };
    assertEquals(readPlanRequest({ text: "a", current })?.current, {
      ...EMPTY_SETTINGS,
      kind: "meeting",
      startHour: 18,
      months: "any",
    });
  },
);

Deno.test("the settings so far are written the model's way, and read back the same", () => {
  const settings = {
    kind: "meeting" as const,
    startHour: 18,
    anyTime: false,
    durationMinutes: 180,
    weekdays: [5],
    days: null,
    startWeekday: null,
    months: { from: "2026-12", to: "2027-01" },
  };
  assertEquals(toWire(settings), {
    kind: "meeting",
    start: "18",
    durationMinutes: 180,
    weekdays: [5],
    days: 0,
    startWeekday: -1,
    monthsFrom: "2026-12",
    monthsTo: "2027-01",
  });
  const read = cleanPlan(wire({ ...toWire(settings) }), MONTHS);
  const back = Object.fromEntries(
    Object.keys(settings).map((k) => [k, read[k as keyof typeof read]]),
  );
  assertEquals(back, settings);
  assertEquals(toWire({ ...EMPTY_SETTINGS, anyTime: true, months: "any" }).start, "any");
});

Deno.test("the message holds the date, the months, the language and what was written", () => {
  const message = buildPlanMessage(
    {
      text: "kun i december",
      earlier: ["Middag en fredag"],
      current: { ...EMPTY_SETTINGS, kind: "meeting" },
    },
    "da",
    NOW,
  );
  assertStringIncludes(message, "Today is Friday, 9 October 2026, Danish time.");
  assertStringIncludes(message, "2026-10 (October 2026)");
  assertStringIncludes(message, "2027-09 (September 2027)");
  assertStringIncludes(message, "questions and options: Danish.");
  assertStringIncludes(message, '"kind":"meeting"');
  assertStringIncludes(message, "Written earlier: <description>Middag en fredag</description>");
  assertStringIncludes(
    message,
    "What the person adds now:\n<description>kun i december</description>",
  );
  assertStringIncludes(
    buildPlanMessage({ text: "Kaffe", earlier: [], current: null }, "en", NOW),
    "The description:\n<description>Kaffe</description>",
  );
});
