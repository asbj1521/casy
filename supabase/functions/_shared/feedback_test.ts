import { assertEquals } from "jsr:@std/assert@1";

import { readFeedback, readLabelCorrection } from "./feedback.ts";

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
