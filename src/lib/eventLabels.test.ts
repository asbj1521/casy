import { describe, expect, it } from "vitest";

import type { EventLabel } from "@/api/eventLabels";
import {
  BATCH_SIZE,
  batchesToLabel,
  clockMinute,
  labelCandidates,
  labelKey,
  MAX_PER_RUN,
  presentKeys,
  updateBook,
  type StoredLabel,
} from "@/lib/eventLabels";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

const NOW = Date.parse("2026-10-10T10:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const timed = (
  title: string,
  start: number,
  hours = 1,
  over: Partial<PhoneEventWithDetails> = {},
): PhoneEventWithDetails => ({
  calendarId: "ek-uni",
  allDay: false,
  free: false,
  cancelled: false,
  declined: false,
  start,
  end: start + hours * HOUR,
  title,
  ...over,
});

const names = new Map([
  ["ek-uni", "Uni"],
  ["ek-home", "Kalender"],
]);

const label = (over: Partial<StoredLabel> = {}): StoredLabel => ({
  kind: "exam",
  importance: "critical",
  prepDays: 3,
  avoidBefore: ["lateNight"],
  recoveryDays: 0,
  strain: "heavy",
  confidence: "high",
  reason: "",
  count: 1,
  ...over,
});

describe("labelKey", () => {
  it("ignores case and spacing, but not the calendar", () => {
    expect(labelKey("ek-uni", "  Eksamen   Statistik ")).toBe(
      labelKey("ek-uni", "eksamen statistik"),
    );
    expect(labelKey("ek-uni", "Eksamen")).not.toBe(labelKey("ek-home", "Eksamen"));
    expect(labelKey("ek-uni", "Eksamen")).not.toBe(labelKey("ek-uni", "Eksamener"));
  });

  it("keeps no readable copy of the title", () => {
    expect(labelKey("ek-uni", "Eksamen")).not.toContain("ksamen");
  });
});

describe("clockMinute", () => {
  it("reads the Danish clock, summer and winter time alike", () => {
    // 07:00 UTC is 09:00 in summer, 08:00 in winter.
    expect(clockMinute(Date.parse("2026-07-01T07:00:00Z"))).toBe(9 * 60);
    expect(clockMinute(Date.parse("2026-12-01T07:00:00Z"))).toBe(8 * 60);
  });
});

describe("labelCandidates", () => {
  it("groups a title's occurrences, counts them, and times it by the nearest", () => {
    const candidates = labelCandidates(
      [
        timed("Forelæsning", NOW + 7 * DAY, 2),
        timed("forelæsning ", NOW + 1 * DAY - 2 * HOUR, 2),
        timed("Forelæsning", NOW + 14 * DAY, 2),
      ],
      names,
      NOW,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].event).toMatchObject({
      title: "forelæsning",
      calendar: "Uni",
      allDay: false,
      minutes: 120,
      count: 3,
    });
    expect(candidates[0].next).toBe(NOW + DAY - 2 * HOUR);
  });

  it("leaves out what isn't busy, other phones' calendars, untitled and long-past events", () => {
    const candidates = labelCandidates(
      [
        timed("Aflyst", NOW + DAY, 1, { cancelled: true }),
        timed("Afslået", NOW + DAY, 1, { declined: true }),
        timed("Ledig", NOW + DAY, 1, { free: true }),
        timed("Andet sted", NOW + DAY, 1, { calendarId: "ek-unknown" }),
        timed("   ", NOW + DAY),
        timed("For længe siden", NOW - 30 * DAY),
        timed("Sidste uge", NOW - 3 * DAY),
      ],
      names,
      NOW,
    );
    expect(candidates.map((c) => c.event.title)).toEqual(["Sidste uge"]);
  });

  it("puts what is coming before what has passed, soonest first", () => {
    const candidates = labelCandidates(
      [
        timed("Om en måned", NOW + 30 * DAY),
        timed("I går", NOW - 2 * DAY),
        timed("I morgen", NOW + DAY),
      ],
      names,
      NOW,
    );
    expect(candidates.map((c) => c.event.title)).toEqual(["I morgen", "Om en måned", "I går"]);
  });

  it("describes an all-day event by its days", () => {
    const [candidate] = labelCandidates(
      [
        {
          calendarId: "ek-home",
          allDay: true,
          free: true,
          cancelled: false,
          declined: false,
          startDay: "2026-10-20",
          endDay: "2026-10-23",
          title: "Ferie",
        },
      ],
      names,
      NOW,
    );
    expect(candidate.event).toMatchObject({
      allDay: true,
      startMinute: 0,
      minutes: 0,
      days: 3,
      calendar: "Kalender",
    });
  });
});

describe("batchesToLabel", () => {
  const many = (n: number) =>
    labelCandidates(
      Array.from({ length: n }, (_, i) => timed(`Event ${i}`, NOW + (i + 1) * HOUR)),
      names,
      NOW,
    );

  it("skips what is labelled or already asked, and batches the rest", () => {
    const candidates = many(BATCH_SIZE + 5);
    const book = { [candidates[0].key]: label() };
    const asked = new Set([candidates[1].key]);
    const batches = batchesToLabel(candidates, book, asked);
    expect(batches.map((b) => b.length)).toEqual([BATCH_SIZE, 3]);
    expect(batches[0][0].key).toBe(candidates[2].key);
  });

  it("asks about at most MAX_PER_RUN titles in one run", () => {
    const batches = batchesToLabel(many(MAX_PER_RUN + 40), {}, new Set());
    expect(batches.flat()).toHaveLength(MAX_PER_RUN);
  });
});

describe("updateBook", () => {
  it("adds labels, never replacing a correction with a background label", () => {
    const corrected = label({ importance: "low", corrected: true });
    const book = updateBook({ a: corrected }, [
      { key: "a", label: label() },
      { key: "b", label: label({ kind: "party" }) },
    ]);
    expect(book.a).toBe(corrected);
    expect(book.b.kind).toBe("party");
    // A new correction replaces the old one.
    expect(updateBook(book, [{ key: "a", label: label({ corrected: true }) }]).a.importance).toBe(
      "critical",
    );
  });

  it("drops labels whose event is gone from the phone", () => {
    const events = [timed("Eksamen", NOW + DAY)];
    const present = presentKeys(events);
    const kept = labelKey("ek-uni", "Eksamen");
    const book = updateBook({ [kept]: label(), gone: label() }, [], present);
    expect(Object.keys(book)).toEqual([kept]);
  });
});

// The label types on both sides must agree: a stored label is a label.
const _check: EventLabel = label();
void _check;
