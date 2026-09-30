// Run with: deno test --node-modules-dir=none --allow-all supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import { parseBusyIntervals } from "./ics.ts";
import { wallClockToUtc } from "./timezones.ts";

const FROM = new Date("2026-01-01T00:00:00Z");
const TO = new Date("2027-01-01T00:00:00Z");

const feed = (...eventLines: string[][]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...eventLines.flatMap((lines, i) => ["BEGIN:VEVENT", `UID:e${i}`, ...lines, "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");

const busy = (ics: string) => parseBusyIntervals(ics, FROM, TO).intervals;

Deno.test("a multi-day all-day event shown as free still blocks (Apple's default)", () => {
  const ics = feed(["DTSTART;VALUE=DATE:20260713", "DTEND;VALUE=DATE:20260720", "TRANSP:TRANSPARENT"]);
  // Summer: Danish midnight is 22:00 UTC the day before.
  assertEquals(busy(ics), [{ start: "2026-07-12T22:00:00.000Z", end: "2026-07-19T22:00:00.000Z" }]);
});

Deno.test("a timed event shown as free still doesn't block", () => {
  const ics = feed(["DTSTART:20261001T100000Z", "DTEND:20261001T110000Z", "TRANSP:TRANSPARENT"]);
  assertEquals(busy(ics), []);
});

Deno.test("a cancelled all-day event doesn't block", () => {
  const ics = feed(["DTSTART;VALUE=DATE:20261001", "DTEND;VALUE=DATE:20261002", "STATUS:CANCELLED"]);
  assertEquals(busy(ics), []);
});

Deno.test("all-day dates without a zone are Danish days, in winter too", () => {
  const ics = feed(["DTSTART;VALUE=DATE:20261214", "DTEND;VALUE=DATE:20261216"]);
  assertEquals(busy(ics), [{ start: "2026-12-13T23:00:00.000Z", end: "2026-12-15T23:00:00.000Z" }]);
});

Deno.test("a weekly recurring all-day event shown as free blocks every week", () => {
  const ics = feed([
    "DTSTART;VALUE=DATE:20261005",
    "DTEND;VALUE=DATE:20261006",
    "RRULE:FREQ=WEEKLY;COUNT=2",
    "TRANSP:TRANSPARENT",
  ]);
  assertEquals(busy(ics), [
    { start: "2026-10-04T22:00:00.000Z", end: "2026-10-05T22:00:00.000Z" },
    { start: "2026-10-11T22:00:00.000Z", end: "2026-10-12T22:00:00.000Z" },
  ]);
});

Deno.test("a floating time (no zone, no Z) is read as Danish clock time", () => {
  const ics = feed(["DTSTART:20261001T100000", "DTEND:20261001T110000"]);
  assertEquals(busy(ics), [{ start: "2026-10-01T08:00:00.000Z", end: "2026-10-01T09:00:00.000Z" }]);
});

Deno.test("a feed that declares its own zone still has its dates read there", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "X-WR-TIMEZONE:UTC",
    "BEGIN:VTIMEZONE",
    "TZID:UTC",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0000",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:a",
    "DTSTART;VALUE=DATE:20261001",
    "DTEND;VALUE=DATE:20261002",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  assertEquals(busy(ics), [{ start: "2026-10-01T00:00:00.000Z", end: "2026-10-02T00:00:00.000Z" }]);
});

Deno.test("wall-clock times convert across daylight saving changes", () => {
  const cph = (y: number, m: number, d: number, h = 0, min = 0) =>
    wallClockToUtc("Europe/Copenhagen", y, m, d, h, min).toISOString();
  assertEquals(cph(2026, 3, 29), "2026-03-28T23:00:00.000Z"); // the night of the change, still winter
  assertEquals(cph(2026, 3, 30), "2026-03-29T22:00:00.000Z"); // the first summer midnight
  assertEquals(cph(2026, 3, 29, 2, 30), "2026-03-29T01:30:00.000Z"); // skipped hour lands an hour later
  assertEquals(cph(2026, 10, 25), "2026-10-24T22:00:00.000Z");
  assertEquals(cph(2026, 10, 26), "2026-10-25T23:00:00.000Z");
});
