import { assertEquals } from "jsr:@std/assert@1";

import { factsOfMembers, scoreDates } from "./rankDates.ts";
import type { Db } from "./supabaseAdmin.ts";

const row = (profile_id: string, starts_at: string, level: string, avoid: string[] = []) => ({
  profile_id,
  starts_at,
  level,
  avoid,
  prep_days: 0,
});

/** A database whose ai_day_facts holds `rows`, answering the one query the ranking makes. */
function fakeDb(rows: unknown[]) {
  const asked: { table?: string; ids?: string[] } = {};
  const db = {
    from: (table: string) => ({
      select: () => ({
        in: (_column: string, ids: string[]) => {
          asked.table = table;
          asked.ids = ids;
          return Promise.resolve({
            data: rows.filter((r) => ids.includes((r as { profile_id: string }).profile_id)),
            error: null,
          });
        },
      }),
    }),
  } as unknown as Db;
  return { db, asked };
}

Deno.test("each member's facts come back in the order the members were given", async () => {
  const { db, asked } = fakeDb([
    row("b", "2026-10-10T07:00:00Z", "critical", ["alcohol", "nonsense"]),
    row("a", "2026-10-12T07:00:00Z", "high"),
  ]);
  const facts = await factsOfMembers(db, ["a", "b", "c"]);
  assertEquals(asked, { table: "ai_day_facts", ids: ["a", "b", "c"] });
  assertEquals(
    facts.map((f) => f.length),
    [1, 1, 0],
  );
  assertEquals(facts[1][0], {
    start: Date.parse("2026-10-10T07:00:00Z"),
    level: "critical",
    avoid: ["alcohol"],
    prepDays: 0,
  });
});

Deno.test("nobody sharing anything scores every date 100", async () => {
  const { db } = fakeDb([]);
  const answer = await scoreDates(db, {
    members: ["a", "b"],
    profile: null,
    single: true,
    dates: [{ start: "2026-10-09T16:00:00Z", end: "2026-10-09T18:00:00Z" }],
  });
  // Nothing was counted, so the 100 says nothing and no score is shown.
  assertEquals(answer, { scores: [100], counted: 0 });
});

Deno.test(
  "a date the night before someone's critical event scores below one that is not",
  async () => {
    // b has a critical exam on Saturday 10 Oct at 09:00 Copenhagen time, keeping clear of late nights.
    const { db } = fakeDb([row("b", "2026-10-10T07:00:00Z", "critical", ["lateNight"])]);
    const { scores, counted } = await scoreDates(db, {
      members: ["a", "b"],
      profile: { effects: [], runsLate: false, strain: "light", recoveryDays: 0 },
      single: true,
      dates: [
        // Friday 18:00 to 00:30: a late night before the exam.
        { start: "2026-10-09T16:00:00Z", end: "2026-10-09T22:30:00Z" },
        // The Wednesday before: nothing near it.
        { start: "2026-10-07T16:00:00Z", end: "2026-10-07T18:00:00Z" },
      ],
    });
    assertEquals(scores, [50, 100]);
    assertEquals(counted, 1);
  },
);
