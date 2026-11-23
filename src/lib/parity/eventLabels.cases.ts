/** eventLabels.ts and eventWarnings.ts's labelledEvents, for EventLabels.swift (#282: labels made natively). */
import { TRIP_NOTES } from "@/lib/casyTripEntry";
import {
  addCorrection,
  batchesToLabel,
  clockMinute,
  correctionsToSend,
  hash,
  labelCandidates,
  labelKey,
  markCalendarStale,
  normalise,
  presentKeys,
  tidyBook,
  updateBook,
  type LabelBook,
  type LabelCorrection,
  type StoredLabel,
} from "@/lib/eventLabels";
import { labelledEvents } from "@/lib/eventWarnings";
import type { PhoneEventWithDetails } from "@/lib/phoneEvents";

import { caseBook, type ParityCase } from "./cases";

const NOW = Date.UTC(2026, 9, 7, 8);
const HOUR = 3_600_000;

const TITLES = [
  "Eksamen",
  "eksamen ",
  "  EKSAMEN  i   Fysik ",
  "Forelæsning",
  "Fly til Oslo ✈️",
  "Æblekage hos mormor",
  "Møde\tmed\nchefen",
  "Fødselsdag 🎂👨‍👩‍👧",
  "",
  "   ",
  "Træning",
  "Padel",
  "Vagt",
  "Rejse til Oslo",
  "ﬁnal",
  "İstanbul",
  "日本語のタイトル",
];
const NOTES = [
  ...TRIP_NOTES,
  "Lagt ind af Casy.",
  "Added by Casy.",
  "",
  "Husk pas",
  " Lagt ind af Casy. ",
];

const LABEL = (importance: string, reason: string) => ({
  kind: "exam" as const,
  importance: importance as "low" | "normal" | "high" | "critical",
  prepDays: 2,
  avoidBefore: ["lateNight" as const],
  recoveryDays: 0,
  strain: "moderate" as const,
  confidence: "high" as const,
  reason,
});

export function eventLabelsCases(): ParityCase[] {
  const { cases, add, int, pick, random } = caseBook(20261123);
  const flag = (odds: number) => random() < odds;
  const day = () =>
    `2026-${String(int(9, 11)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
  const event = (calendars: string[]): PhoneEventWithDetails => {
    const base = {
      calendarId: pick(calendars),
      free: flag(0.15),
      cancelled: flag(0.05),
      declined: flag(0.05),
      title: flag(0.9) ? pick(TITLES) : undefined,
      notes: flag(0.3) ? pick(NOTES) : undefined,
      location: flag(0.2) ? "Aarhus" : undefined,
    };
    if (flag(0.25)) {
      const startDay = day();
      return { ...base, allDay: true, startDay, endDay: pick([startDay, day()]) };
    }
    const start = NOW + int(-14 * 24, 60 * 24) * HOUR + int(0, 3) * 900_000;
    return { ...base, allDay: false, start, end: start + int(1, 8) * 1_800_000 };
  };

  for (const t of [...TITLES, "a", "abc", "Eksamen\nUni", "x".repeat(300), "æøå", "🙂"]) {
    add("hash", { text: t }, hash(t));
    add("normalise", { title: t }, normalise(t));
    add("labelKey", { calendarId: "CAL-1", title: t }, labelKey("CAL-1", t));
  }
  for (const ms of [
    NOW,
    Date.UTC(2026, 2, 29, 0, 30),
    Date.UTC(2026, 2, 29, 1, 30),
    Date.UTC(2026, 9, 25, 0, 59),
    Date.UTC(2026, 9, 25, 1, 0),
    Date.UTC(2026, 11, 31, 23, 15),
    Date.UTC(1969, 11, 31, 22, 45),
  ])
    add("clockMinute", { ms }, clockMinute(ms));

  const book = (keys: string[], calendars: string[]): LabelBook => {
    const out: LabelBook = {};
    for (const k of keys) {
      const label: StoredLabel = {
        ...LABEL(pick(["low", "normal", "high", "critical"]), `r ${k}`),
        count: int(1, 4),
      };
      if (flag(0.3)) label.corrected = true;
      if (flag(0.7)) label.calendarId = pick(calendars);
      if (flag(0.2)) label.stale = true;
      out[k] = label;
    }
    return out;
  };

  for (let i = 0; i < 60; i++) {
    const calendars = Array.from({ length: int(1, 3) }, (_, n) => `CAL-${n}`);
    const names = new Map(calendars.filter(() => flag(0.85)).map((c, n) => [c, `Navn ${n}`]));
    const events = Array.from({ length: int(0, 25) }, () => event(calendars));
    const now = NOW + int(-48, 48) * HOUR;
    const candidates = labelCandidates(events, names, now);
    add("labelCandidates", { events, names: Object.fromEntries(names), now }, candidates);
    const keys = candidates.map((c) => c.key);
    const known = book(
      [...keys.filter(() => flag(0.5)), ...(flag(0.5) ? ["gone-key"] : [])],
      calendars,
    );
    const asked = keys.filter(() => flag(0.2));
    add(
      "batchesToLabel",
      { candidates, book: known, asked },
      batchesToLabel(candidates, known, new Set(asked)),
    );
    const present = presentKeys(events);
    add("presentKeys", { events }, [...present].sort());
    const tidied = tidyBook(known, present, candidates);
    add(
      "tidyBook",
      { book: known, present: [...present], candidates },
      tidied === known ? "same" : tidied,
    );
    const added = keys
      .filter(() => flag(0.4))
      .map((key) => ({
        key,
        label: {
          ...LABEL("high", `new ${key}`),
          count: 2,
          ...(flag(0.3) ? { corrected: true } : {}),
        },
      }));
    const withPresent = flag(0.5);
    add(
      "updateBook",
      { book: known, added, present: withPresent ? [...present] : null },
      updateBook(known, added, withPresent ? present : undefined),
    );
    const calendarId = pick(calendars);
    const marked = markCalendarStale(known, calendarId);
    add(
      "markCalendarStale",
      { book: known, calendarId },
      { book: marked.book, keys: [...marked.keys].sort() },
    );
    // The label as the native screens read it (EventLabel): the book's own fields
    // (count, corrected, calendarId, stale) ride along on the web and aren't read.
    add(
      "labelledEvents",
      { events, book: known },
      labelledEvents(events, known).map((e) => {
        const { count, corrected, calendarId, stale, ...label } = e.label as StoredLabel;
        void [count, corrected, calendarId, stale];
        return { ...e, label };
      }),
    );
  }

  // A long one: past the batch size and the per-run cap.
  const many = Array.from({ length: 340 }, (_, i) => ({
    key: `k${i}`,
    calendarId: "CAL-0",
    next: NOW + i * HOUR,
    event: {
      title: `T${i}`,
      calendar: "Navn",
      allDay: false,
      startMinute: 600,
      minutes: 60,
      days: 1,
      count: 1,
    },
  }));
  add(
    "batchesToLabel",
    { candidates: many, book: {}, asked: ["k3", "k20"] },
    batchesToLabel(many, {}, new Set(["k3", "k20"])),
  );

  let corrections: LabelCorrection[] = [];
  for (let i = 0; i < 40; i++) {
    const correction: LabelCorrection = {
      key: `k${int(0, 12)}`,
      calendarId: "CAL-0",
      title: pick(TITLES),
      calendar: "Navn",
      note: `note ${i}`,
      label: LABEL("critical", `fixed ${i}`),
      at: NOW + i,
    };
    add("addCorrection", { corrections, correction }, addCorrection(corrections, correction));
    corrections = addCorrection(corrections, correction);
  }
  add("correctionsToSend", { corrections }, correctionsToSend(corrections));
  return cases;
}
