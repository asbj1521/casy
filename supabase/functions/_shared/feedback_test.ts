import { assertEquals } from "jsr:@std/assert@1";

import { readFeedback, readLabelCorrection, readPlanFeedback } from "./feedback.ts";

const label = {
  kind: "exam",
  importance: "critical",
  prepDays: 3,
  avoidBefore: ["lateNight", "alcohol"],
  recoveryDays: 0,
  strain: "heavy",
  confidence: "high",
  reason: "An exam",
};

const correction = {
  title: "Eksamen i statistik",
  calendar: "Uni",
  previous: { ...label, importance: "normal" },
  note: "Det er en mundtlig eksamen, og den er meget vigtig",
  label,
};

Deno.test("a label correction is rebuilt from the parts it may have", () => {
  const read = readLabelCorrection({
    ...correction,
    // Anything else in the request is left behind.
    place: "Aarhus",
    dates: ["2026-10-12"],
    other: { events: [] },
  });
  assertEquals(Object.keys(read!).sort(), ["calendar", "label", "note", "previous", "title"]);
  assertEquals(read!.title, "Eksamen i statistik");
  assertEquals(read!.label.importance, "critical");
});

Deno.test("emails and links in a calendar's name are taken out", () => {
  const read = readLabelCorrection({ ...correction, calendar: "mia@example.com https://x.test/y" });
  assertEquals(read!.calendar.includes("@"), false);
  assertEquals(read!.calendar.includes("https"), false);
});

Deno.test("long text is cut, control characters go", () => {
  const read = readLabelCorrection({
    ...correction,
    title: "x".repeat(500) + "\u0000",
    note: "y".repeat(2000),
  });
  assertEquals(read!.title.length <= 120, true);
  assertEquals(read!.note.length <= 300, true);
  assertEquals(read!.title.includes("\u0000"), false);
});

Deno.test("a correction missing a part, or with a label that isn't one, is refused", () => {
  assertEquals(readLabelCorrection({ ...correction, note: "  " }), null);
  assertEquals(readLabelCorrection({ ...correction, title: undefined }), null);
  assertEquals(readLabelCorrection({ ...correction, label: { kind: "nonsense" } }), null);
  assertEquals(readLabelCorrection({ ...correction, previous: null }), null);
  assertEquals(readLabelCorrection("x"), null);
  assertEquals(readLabelCorrection(null), null);
});

Deno.test("only kinds we take are read", () => {
  assertEquals(readFeedback({ kind: "label", data: correction })?.kind, "label");
  assertEquals(readFeedback({ kind: "other", data: correction }), null);
  assertEquals(readFeedback({ data: correction }), null);
  assertEquals(readFeedback({ kind: "label", data: { ...correction, note: "" } }), null);
});

const settings = {
  kind: "meeting",
  startHour: 19,
  anyTime: false,
  startWindow: null,
  durationMinutes: 180,
  weekdays: [5],
  days: null,
  startWeekday: null,
  months: { from: "2026-11", to: "2026-11" },
};

const plan = {
  texts: ["Middag hos mig en fredag aften i november"],
  plan: {
    ...settings,
    startHour: 18,
    title: "Middag",
    place: null,
    note: null,
    assumed: ["startHour"],
    // The group and its members never come along.
    people: { without: [], optional: [], required: ["Sara"] },
    questions: [{ question: "?", options: [] }],
  },
  overridden: ["startHour"],
  final: settings,
};

Deno.test("a plan keeps the text, the AI's settings, what was changed and where it ended", () => {
  const read = readPlanFeedback(plan)!;
  assertEquals(read.texts, ["Middag hos mig en fredag aften i november"]);
  assertEquals(read.plan.startHour, 18);
  assertEquals(read.plan.assumed, ["startHour"]);
  assertEquals(read.overridden, ["startHour"]);
  assertEquals(read.final.startHour, 19);
  // Nothing else of the plan is kept: not the people, not the questions.
  assertEquals("people" in read.plan, false);
  assertEquals("questions" in read.plan, false);
});

Deno.test("a plan sent as it was says so: nothing overridden", () => {
  assertEquals(readPlanFeedback({ ...plan, overridden: [] })!.overridden, []);
});

Deno.test("field names are only the real ones, each once", () => {
  const read = readPlanFeedback({
    ...plan,
    overridden: ["startHour", "startHour", "nonsense", "days"],
  })!;
  assertEquals(read.overridden, ["startHour", "days"]);
});

Deno.test("a plan with something out of range, or missing, is refused", () => {
  assertEquals(readPlanFeedback({ ...plan, texts: [] }), null);
  assertEquals(readPlanFeedback({ ...plan, texts: ["a", "b", "c", "d", "e", "f"] }), null);
  assertEquals(readPlanFeedback({ ...plan, texts: ["  "] }), null);
  assertEquals(readPlanFeedback({ ...plan, final: { ...settings, startHour: 30 } }), null);
  assertEquals(readPlanFeedback({ ...plan, final: { ...settings, kind: "party" } }), null);
  assertEquals(
    readPlanFeedback({ ...plan, final: { ...settings, months: { from: "x", to: "2026-11" } } }),
    null,
  );
  assertEquals(readPlanFeedback({ ...plan, final: { ...settings, weekdays: [9] } }), null);
  assertEquals(readPlanFeedback({ ...plan, plan: null }), null);
  assertEquals(readPlanFeedback(null), null);
});

Deno.test("exact days are kept as days, and checked as such (#134)", () => {
  const days = { from: "2026-10-09", to: "2026-11-05", days: true as const };
  const read = readPlanFeedback({ ...plan, final: { ...settings, months: days } })!;
  assertEquals(read.final.months, days);
  assertEquals(
    readPlanFeedback({ ...plan, final: { ...settings, months: { ...days, to: "2026-11" } } }),
    null,
  );
  assertEquals(
    readPlanFeedback({ ...plan, final: { ...settings, months: { ...days, days: "yes" } } }),
    null,
  );
});

Deno.test("long text is cut", () => {
  const read = readPlanFeedback({ ...plan, texts: ["x".repeat(5000)] })!;
  assertEquals(read.texts[0].length <= 600, true);
});

Deno.test("a plan is read through readFeedback too", () => {
  assertEquals(readFeedback({ kind: "plan", data: plan })?.kind, "plan");
  assertEquals(readFeedback({ kind: "plan", data: { ...plan, texts: [] } }), null);
});
