// Run with: deno test --node-modules-dir=none --allow-all supabase/review/
import { assert, assertEquals } from "jsr:@std/assert@1";
import { parseBusyIntervals } from "../functions/_shared/ics.ts";
import { syncWindow } from "../functions/_shared/syncWindow.ts";
import {
  agreedDate,
  type DemoDate,
  demoEmail,
  feedUrl,
  PEOPLE,
  type PersonKey,
  voteDates,
} from "./plan.ts";

async function busyOf(key: PersonKey, now: Date) {
  const text = await Deno.readTextFile(new URL(`../../public/review/${key}.ics`, import.meta.url));
  const { start, end } = syncWindow(now);
  return parseBusyIntervals(text, start, end);
}

const overlaps = (a: DemoDate, b: { start: string; end: string }) =>
  Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);

/** Danish wall-clock hour and weekday of an instant, read with Intl (never a Date's local getters). */
function danish(iso: string): { hour: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(new Date(iso));
  return {
    hour: Number(parts.find((p) => p.type === "hour")!.value),
    weekday: parts.find((p) => p.type === "weekday")!.value,
  };
}

// Winter, summer, and a run across the new year and a daylight saving change.
const NOWS = [
  new Date("2026-11-04T12:00:00Z"),
  new Date("2027-06-20T21:30:00Z"),
  new Date("2027-12-20T23:30:00Z"),
  new Date("2027-03-14T08:00:00Z"),
];

for (const now of NOWS) {
  Deno.test(
    `every feed has busy time and leaves the demo's dates free (${now.toISOString()})`,
    async () => {
      const dates = [...voteDates(now.getTime()), agreedDate(now.getTime())];
      for (const person of PEOPLE) {
        const feed = await busyOf(person.key, now);
        assert(feed.intervals.length > 50, `${person.key} should have weeks of busy time`);
        assertEquals(feed.calendarName, `${person.name} (sample)`);
        for (const date of dates) {
          const clash = feed.intervals.find((b) => overlaps(date, b));
          assertEquals(clash, undefined, `${person.key} is busy at ${date.start}`);
        }
      }
    },
  );

  Deno.test(
    `the vote is three Fridays 19 to 22, a week or more ahead (${now.toISOString()})`,
    () => {
      const dates = voteDates(now.getTime());
      assertEquals(dates.length, 3);
      for (const d of dates) {
        assertEquals(danish(d.start), { hour: 19, weekday: "Fri" });
        assertEquals(danish(d.end).hour, 22);
        assert(Date.parse(d.start) - now.getTime() > 6 * 24 * 3600_000);
      }
      assertEquals(new Set(dates.map((d) => d.start)).size, 3);
    },
  );

  Deno.test(
    `the agreed event is a Sunday 11 to 13, two weeks or more ahead (${now.toISOString()})`,
    () => {
      const d = agreedDate(now.getTime());
      assertEquals(danish(d.start), { hour: 11, weekday: "Sun" });
      assertEquals(danish(d.end).hour, 13);
      assert(Date.parse(d.start) - now.getTime() > 13 * 24 * 3600_000);
    },
  );
}

Deno.test("demo emails are plus-aliases of the owner's address", () => {
  assertEquals(demoEmail("Owner@Gmail.com", "casy-review"), "owner+casy-review@gmail.com");
  assertEquals(demoEmail(" owner+old@gmail.com ", "casy-sara"), "owner+casy-sara@gmail.com");
  assertEquals(demoEmail("not an email", "casy-sara"), null);
  assertEquals(demoEmail("owner@localhost", "casy-sara"), null);
});

Deno.test("each person has their own alias and feed on casy.app", () => {
  assertEquals(new Set(PEOPLE.map((p) => p.alias)).size, PEOPLE.length);
  assertEquals(feedUrl("sara"), "https://casy.app/review/sara.ics");
});
