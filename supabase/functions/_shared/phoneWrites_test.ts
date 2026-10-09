// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assertEquals, assertThrows } from "jsr:@std/assert@1";

import type { AgreedEvent } from "./eventIcs.ts";
import { HttpError } from "./http.ts";
import {
  eventUrl,
  parseReports,
  PHONE_WRITE_FAILED,
  phoneEntry,
  reportChange,
} from "./phoneWrites.ts";

const ID = "8b0c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d";
const NOW = "2026-10-14T10:00:00.000Z";

const dinner: AgreedEvent = {
  id: ID,
  title: "Dinner",
  place: "Hos Anna",
  note: null,
  groupName: "Vennerne",
  others: ["Anna", "Bo"],
  kind: "single",
  start: "2026-10-20T16:00:00.000Z",
  end: "2026-10-20T19:00:00.000Z",
};

Deno.test("an entry reads as the iCloud one does, in the reader's language", () => {
  assertEquals(phoneEntry(dinner, "da"), {
    title: "Middag med Vennerne",
    location: "Hos Anna",
    notes: "Aftalt i Casy med Anna og Bo.",
    allDay: false,
    start: dinner.start,
    end: dinner.end,
  });
  assertEquals(phoneEntry({ ...dinner, place: null }, "en").title, "Dinner with Vennerne");
  assertEquals(phoneEntry({ ...dinner, place: null }, "en").location, null);
});

Deno.test("a trip is whole Danish days, end exclusive", () => {
  const entry = phoneEntry(
    {
      ...dinner,
      kind: "vacation",
      start: "2026-10-23T22:00:00.000Z",
      end: "2026-10-26T23:00:00.000Z",
    },
    "da",
  );
  assertEquals([entry.allDay, entry.startDay, entry.endDay], [true, "2026-10-24", "2026-10-27"]);
});

Deno.test("each entry links back to its event", () => {
  assertEquals(eventUrl(ID), `https://casy.app/events/${ID}`);
});

const row = {
  wanted: true,
  added: false,
  requeue: false,
  attempts: 2,
  device_event_id: null as string | null,
};
const report = (outcome: string, eventId: string | null = null) =>
  ({ proposalId: ID, outcome, eventId }) as Parameters<typeof reportChange>[0];

Deno.test("added: in the calendar, with the phone's id, any failure forgotten", () => {
  assertEquals(reportChange(report("added", "EK-1"), row, NOW), {
    kind: "update",
    values: {
      attempts: 0,
      last_error: null,
      updated_at: NOW,
      added: true,
      refresh: false,
      gone_at: null,
      device_event_id: "EK-1",
    },
  });
});

Deno.test("updated keeps the old id when the phone sends none", () => {
  const change = reportChange(
    report("updated"),
    { ...row, added: true, device_event_id: "EK-1" },
    NOW,
  );
  assertEquals(change.kind === "update" && change.values.device_event_id, "EK-1");
});

Deno.test("gone while wanted: deleted by hand, so left out from now on", () => {
  const change = reportChange(report("gone"), { ...row, added: true }, NOW);
  assertEquals(change.kind === "update" && change.values.wanted, false);
  assertEquals(change.kind === "update" && change.values.gone_at, NOW);
});

Deno.test("gone or removed while being taken out: out, and a moved event's row goes", () => {
  const leaving = { ...row, wanted: false, added: true };
  for (const outcome of ["gone", "removed"]) {
    const change = reportChange(report(outcome), leaving, NOW);
    assertEquals(change.kind === "update" && change.values.added, false);
    assertEquals(change.kind === "update" && "gone_at" in change.values, false);
    assertEquals(reportChange(report(outcome), { ...leaving, requeue: true }, NOW), {
      kind: "forgetMoved",
    });
  }
});

Deno.test("failed counts a try and says why, for the page", () => {
  assertEquals(reportChange(report("failed"), row, NOW), {
    kind: "update",
    values: { attempts: 3, last_error: PHONE_WRITE_FAILED, updated_at: NOW },
  });
});

Deno.test("reports are checked: an event id, a known outcome, a sane phone id", () => {
  assertEquals(
    parseReports({ reports: [{ proposalId: ID.toUpperCase(), outcome: "added", eventId: "x" }] }),
    [{ proposalId: ID, outcome: "added", eventId: "x" }],
  );
  assertEquals(
    parseReports({ reports: [{ proposalId: ID, outcome: "removed", eventId: 5 }] })[0].eventId,
    null,
  );
  for (const body of [
    {},
    { reports: [{ proposalId: "nope", outcome: "added" }] },
    { reports: [{ proposalId: ID, outcome: "exploded" }] },
  ]) {
    assertThrows(() => parseReports(body), HttpError);
  }
});
