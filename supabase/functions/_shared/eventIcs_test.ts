// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

import { eventUids } from "./appleBusy.ts";
import { parseBusyIntervals } from "./ics.ts";
import {
  type AgreedEvent,
  buildEventIcs,
  eventResourceName,
  eventSummary,
  foldLine,
  localTitle,
} from "./eventIcs.ts";

const NOW = new Date("2026-09-28T12:00:00Z");

const dinner: AgreedEvent = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "Dinner",
  groupName: "The friends",
  others: ["Anna", "Bo", "Carl"],
  kind: "single",
  // 18:00 to 21:00 in Copenhagen (summer time, UTC+2).
  start: "2026-10-02T16:00:00.000Z",
  end: "2026-10-02T19:00:00.000Z",
};

/** The unfolded lines of a document, for easy lookups. */
const linesOf = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

Deno.test("a timed event is written in UTC, with a stable UID", () => {
  const lines = linesOf(buildEventIcs(dinner, "en", NOW));
  assert(lines.includes("DTSTART:20261002T160000Z"));
  assert(lines.includes("DTEND:20261002T190000Z"));
  assert(lines.includes("UID:11111111-2222-3333-4444-555555555555@casy.app"));
  assert(lines.includes("DTSTAMP:20260928T120000Z"));
  assert(!lines.some((l) => l.startsWith("METHOD")), "CalDAV refuses a METHOD in a stored event");
});

Deno.test("the title and description are in the reader's language", () => {
  const en = linesOf(buildEventIcs(dinner, "en", NOW));
  assert(en.includes("SUMMARY:Dinner with The friends"));
  assert(en.includes("DESCRIPTION:Agreed in Casy with Anna\\, Bo and Carl."));
  const da = linesOf(buildEventIcs(dinner, "da", NOW));
  assert(da.includes("SUMMARY:Middag med The friends"));
  assert(da.includes("DESCRIPTION:Aftalt i Casy med Anna\\, Bo og Carl."));
});

Deno.test("a typed title is kept as written; old type names still translate", () => {
  assertEquals(localTitle("Board games", "da"), "Board games");
  assertEquals(localTitle("Gaming session", "da"), "Gaming");
  assertEquals(localTitle("Gaming session", "en"), "Gaming");
  assertEquals(
    eventSummary({ ...dinner, title: "Weekend trip" }, "da"),
    "Weekendtur med The friends",
  );
});

Deno.test("a vacation is whole days, ending the day after the last", () => {
  // Monday 5 Oct to Friday 9 Oct: local midnight to local midnight.
  const vacation = {
    ...dinner,
    kind: "vacation",
    start: "2026-10-04T22:00:00.000Z",
    end: "2026-10-09T22:00:00.000Z",
  };
  const lines = linesOf(buildEventIcs(vacation, "en", NOW));
  assert(lines.includes("DTSTART;VALUE=DATE:20261005"));
  assert(lines.includes("DTEND;VALUE=DATE:20261010"));
});

Deno.test("commas, semicolons and backslashes in names are escaped", () => {
  const odd = { ...dinner, groupName: "Us; them, and \\ others" };
  assertStringIncludes(buildEventIcs(odd, "en", NOW), "Us\\; them\\, and \\\\ others");
});

Deno.test("long lines are folded at 75 octets without splitting a character", () => {
  const line = "SUMMARY:" + "æ".repeat(80);
  const folded = foldLine(line);
  for (const part of folded.split("\r\n")) {
    assert(new TextEncoder().encode(part).length <= 75, part);
  }
  assertEquals(folded.replace(/\r\n /g, ""), line);
});

Deno.test("Casy's own reader understands what it writes", () => {
  const ics = buildEventIcs(dinner, "da", NOW);
  const { intervals } = parseBusyIntervals(ics, new Date("2026-09-01"), new Date("2026-12-01"));
  assertEquals(intervals, [{ start: "2026-10-02T16:00:00.000Z", end: "2026-10-02T19:00:00.000Z" }]);
});

Deno.test("the calendar entry's file name is stable per event", () => {
  assertEquals(eventResourceName(dinner.id), "casy-11111111-2222-3333-4444-555555555555.ics");
});

Deno.test("the UIDs in a document are found, folded or not, whatever else is in it", () => {
  assertEquals(eventUids(buildEventIcs(dinner, "en", NOW)), [`${dinner.id}@casy.app`]);
  const folded =
    "BEGIN:VEVENT\r\nUID:a-very-long-uid-that-an-\r\n other-server-folded@example.com\r\nEND:VEVENT\r\n";
  assertEquals(eventUids(folded), ["a-very-long-uid-that-an-other-server-folded@example.com"]);
  assertEquals(eventUids("BEGIN:VEVENT\nUID;X-PARAM=1:with-param\nEND:VEVENT"), ["with-param"]);
  assertEquals(eventUids("no events here"), []);
});
